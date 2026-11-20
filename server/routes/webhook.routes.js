import express from 'express';
import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

const WEBHOOK_AUTH_KEY = process.env.REVENUECAT_WEBHOOK_AUTH_KEY;

// In-process idempotency guard. RevenueCat may deliver the same event more than
// once; ignore duplicates within this process lifetime. (For multi-instance
// durability, replace with a processed_webhook_events table.)
const seenEventIds = new Map(); // id -> timestamp
const SEEN_MAX = 5000;
function alreadyProcessed(id) {
  return !!id && seenEventIds.has(id);
}
// Only call after the event has been fully processed. Marking earlier (e.g. on
// first sight) would make a failed delivery's retry look like a duplicate and
// the subscription update would be lost forever.
function markProcessed(id) {
  if (!id) return;
  seenEventIds.set(id, Date.now());
  if (seenEventIds.size > SEEN_MAX) {
    const drop = Math.floor(SEEN_MAX * 0.1);
    let i = 0;
    for (const k of seenEventIds.keys()) { seenEventIds.delete(k); if (++i >= drop) break; }
  }
}

// Map RevenueCat product identifiers to subscription tiers
function getTierFromProductId(productId) {
  if (!productId) return 'free';
  const id = productId.toLowerCase();
  if (id.includes('ultra')) return 'ultra';
  // All current products (com.brainlift.app.Weekly/Monthly/Annual) map to premium
  if (id.includes('brainlift')) return 'premium';
  return 'free';
}

// Map RevenueCat entitlement IDs to subscription tiers
function getTierFromEntitlements(entitlementIds) {
  if (!entitlementIds || !Array.isArray(entitlementIds)) return null;
  if (entitlementIds.includes('Ultra')) return 'ultra';
  if (entitlementIds.includes('Pro')) return 'premium';
  return null;
}

// RevenueCat webhook event types that grant access
const GRANT_EVENTS = [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
];

// RevenueCat webhook event types that revoke access
const REVOKE_EVENTS = [
  'EXPIRATION',
  'BILLING_ISSUE',
];

// POST /api/webhooks/revenuecat
router.post('/', async (req, res) => {
  try {
    // Verify authorization — fail closed if no key is configured.
    if (!WEBHOOK_AUTH_KEY) {
      logger.error('Webhook', 'REVENUECAT_WEBHOOK_AUTH_KEY is not configured — refusing webhook');
      return res.status(500).json({ error: 'Webhook auth not configured' });
    }
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${WEBHOOK_AUTH_KEY}`) {
      logger.warn('Webhook', 'Invalid or missing authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = req.body?.event;
    if (!event) {
      logger.warn('Webhook', 'No event in webhook payload');
      return res.status(400).json({ error: 'Missing event data' });
    }

    // Idempotency: ignore a duplicate delivery of the same event.
    if (alreadyProcessed(event.id)) {
      logger.info('Webhook', `Duplicate event ignored: ${event.id}`);
      return res.status(200).json({ success: true, duplicate: true });
    }

    const {
      type,
      app_user_id,
      product_id,
      expiration_at_ms,
      entitlement_ids,
      transferred_from,
      transferred_to,
    } = event;

    logger.info('Webhook', `RevenueCat event: ${type}`, {
      app_user_id,
      product_id,
      entitlement_ids,
      transferred_from,
      transferred_to,
    });

    const supabase = getSupabase();

    // Handle TRANSFER events separately (they don't have app_user_id)
    if (type === 'TRANSFER') {
      // transferred_from/transferred_to are arrays of user IDs (app_user_id + aliases)
      // Filter out anonymous IDs (start with $RCAnonymous)
      const fromIds = (transferred_from || []).filter(id => !id.startsWith('$'));
      const toIds = (transferred_to || []).filter(id => !id.startsWith('$'));

      logger.info('Webhook', `Transfer: from ${JSON.stringify(fromIds)} to ${JSON.stringify(toIds)}`);

      // Downgrade source users to free
      for (const userId of fromIds) {
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (error) {
          logger.error('Webhook', `Failed to downgrade transferred-from user ${userId}:`, error);
        } else {
          logger.info('Webhook', `Downgraded transferred-from user: ${userId} -> free`);
        }
      }

      // Note: We don't upgrade the destination user here because we don't know
      // the tier/product from a TRANSFER event. RevenueCat will send a separate
      // INITIAL_PURCHASE or RENEWAL event for the destination user if applicable.

      markProcessed(event.id);
      return res.status(200).json({ success: true });
    }

    if (!app_user_id) {
      logger.warn('Webhook', 'No app_user_id in event');
      return res.status(400).json({ error: 'Missing app_user_id' });
    }

    // Determine the tier from entitlements (preferred) or product id.
    const tier = getTierFromEntitlements(entitlement_ids) ?? getTierFromProductId(product_id);

    // Calculate expiration date
    const expirationDate = expiration_at_ms
      ? new Date(expiration_at_ms).toISOString()
      : null;

    if (GRANT_EVENTS.includes(type)) {
      // Grant or update subscription
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_end_date: expirationDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', app_user_id);

      if (error) {
        logger.error('Webhook', `Failed to update profile for ${app_user_id}:`, error);
        return res.status(500).json({ error: 'Failed to update subscription' });
      }

      logger.info('Webhook', `Subscription updated: ${app_user_id} -> ${tier} (expires: ${expirationDate})`);

    } else if (REVOKE_EVENTS.includes(type)) {
      // Revoke subscription - downgrade to free
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_end_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', app_user_id);

      if (error) {
        logger.error('Webhook', `Failed to downgrade profile for ${app_user_id}:`, error);
        return res.status(500).json({ error: 'Failed to update subscription' });
      }

      logger.info('Webhook', `Subscription revoked: ${app_user_id} -> free`);

    } else if (type === 'CANCELLATION') {
      // User cancelled but may still have access until expiration
      // Keep current tier but log the cancellation
      logger.info('Webhook', `Subscription cancelled (still active until expiration): ${app_user_id}`);

    } else {
      logger.info('Webhook', `Unhandled event type: ${type} for ${app_user_id}`);
    }

    // Processed successfully — record for idempotency, then acknowledge.
    markProcessed(event.id);
    res.status(200).json({ success: true });

  } catch (error) {
    logger.error('Webhook', 'RevenueCat webhook error:', error);
    // 5xx so RevenueCat retries with backoff. Swallowing this as 200 can leave
    // an expired subscription stuck on a paid tier.
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
