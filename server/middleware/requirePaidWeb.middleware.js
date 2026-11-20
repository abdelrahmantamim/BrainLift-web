// Block free-tier users from web feature endpoints.
//
// A request is "web" when EITHER the session was tagged platform='web' at
// creation time OR the current request's Origin matches the web allowlist.
// The Origin fallback covers OAuth flows where the session row wasn't tagged
// at creation (e.g. better-auth social callback handler), and also hardens
// against stolen mobile tokens replayed in a browser.
//
// Mobile sessions (no Origin header, no web Origin) are a no-op fall-through.

import { getSupabase } from '../config/services.config.js';
import { detectPlatform } from '../utils/session-platform.js';
import logger from '../utils/serverLogger.js';

const TIER_CACHE_KEY = '__cachedTier';

async function getUserTierCached(req) {
  if (req[TIER_CACHE_KEY]) return req[TIER_CACHE_KEY];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_end_date')
      .eq('id', req.userId)
      .single();

    // PGRST116 = zero rows: the profile genuinely doesn't exist -> free.
    // Any other error is an outage; throw so the caller returns 500
    // (retryable) instead of 402-paywalling a paying user.
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Tier lookup failed: ${error.message || error.code}`);
    }
    if (!data) {
      req[TIER_CACHE_KEY] = 'free';
      return 'free';
    }
    if (data.subscription_end_date && new Date(data.subscription_end_date) < new Date()) {
      req[TIER_CACHE_KEY] = 'free';
      return 'free';
    }
    const tier = data.subscription_tier || 'free';
    req[TIER_CACHE_KEY] = tier;
    return tier;
  } catch (error) {
    logger.error('requirePaidWeb', 'Failed to get user tier:', error);
    // Let the outer middleware catch return 500 (retryable) rather than treating
    // an outage as a paywall block (402) for paid users.
    throw error;
  }
}

export const requirePaidWeb = async (req, res, next) => {
  try {
    const sessionPlatform = req.session?.platform || 'mobile';
    const requestPlatform = detectPlatform(req); // from current request Origin
    const isWeb = sessionPlatform === 'web' || requestPlatform === 'web';

    if (!isWeb) {
      // Mobile: no-op, identical to pre-change behavior.
      return next();
    }

    if (!req.userId) {
      // Defensive: requireAuth runs first and would 401, but handle the case.
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }

    const tier = await getUserTierCached(req);
    // Share with downstream middleware (checkSubscriptionLimit) so the same
    // request doesn't repeat the identical profiles lookup.
    req.subscriptionTier = tier;
    if (tier === 'free') {
      return res.status(402).json({
        error: {
          code: 'WEB_PAID_ONLY',
          message: 'Web access requires a paid subscription. Please subscribe in the BrainLift mobile app.',
        },
      });
    }

    return next();
  } catch (error) {
    logger.error('requirePaidWeb', 'Middleware error:', error);
    // Fail closed on error: if we can't verify, deny rather than expose.
    return res.status(500).json({ error: { message: 'Authorization error' } });
  }
};

export default requirePaidWeb;
