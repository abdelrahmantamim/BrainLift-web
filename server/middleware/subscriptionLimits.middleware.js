import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';
import { reserveFeatureUsage, finalizeFeatureUsage, releaseFeatureUsage } from '../services/featureUsage.service.js';

/**
 * Limit periods:
 *  - 'lifetime': tracked in profiles.lifetime_feature_usage (never resets)
 *  - 'weekly':   tracked in profiles.weekly_feature_usage (resets each Monday)
 *  - 'daily':    tracked in profiles.daily_feature_usage (resets each day)
 */

// Fallback limits used ONLY if DB is completely unavailable.
// Each feature is { limit, period }.
const DEFAULT_SUBSCRIPTION_LIMITS = {
  free: {
    quiz:         { limit: 10, period: 'lifetime' },
    flashcard:    { limit: 10, period: 'lifetime' },
    file_upload:  { limit: 10, period: 'lifetime' },
    chat:         { limit: 10, period: 'weekly' },
    export:       { limit: 0,  period: 'weekly' },
    chart:        { limit: 1,  period: 'lifetime' },
    file_storage: { limit: 10, period: 'lifetime' },
  },
  premium: {
    quiz:         { limit: 75,  period: 'daily' },
    flashcard:    { limit: 75,  period: 'daily' },
    file_upload:  { limit: 100, period: 'daily' },
    chat:         { limit: 100, period: 'daily' },
    export:       { limit: 100, period: 'daily' },
    chart:        { limit: 100, period: 'daily' },
    file_storage: { limit: 100, period: 'lifetime' },
  },
  ultra: {
    quiz:         { limit: -1, period: 'daily' },
    flashcard:    { limit: -1, period: 'daily' },
    file_upload:  { limit: -1, period: 'daily' },
    chat:         { limit: -1, period: 'daily' },
    export:       { limit: -1, period: 'daily' },
    chart:        { limit: -1, period: 'daily' },
    file_storage: { limit: -1, period: 'lifetime' },
  },
};

// Cached limits from DB
let cachedLimits = null;
let limitsLastFetched = 0;
const LIMITS_CACHE_TTL = 60_000; // 1 minute

/**
 * Load subscription limits from the database app_config table.
 */
async function loadLimitsFromDB() {
  const now = Date.now();
  if (cachedLimits && now - limitsLastFetched < LIMITS_CACHE_TTL) {
    return cachedLimits;
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'subscription_limits')
      .single();

    if (error || !data) {
      logger.warn('SubscriptionLimits', 'Failed to load from DB, using defaults');
      cachedLimits = DEFAULT_SUBSCRIPTION_LIMITS;
    } else {
      cachedLimits = data.value;
    }
    limitsLastFetched = now;
    return cachedLimits;
  } catch (error) {
    logger.error('SubscriptionLimits', 'Error loading limits:', error);
    return cachedLimits || DEFAULT_SUBSCRIPTION_LIMITS;
  }
}

/**
 * Normalize a feature config from DB.
 * Supports both new format { limit, period } and legacy flat number format.
 */
function normalizeFeatureConfig(featureConfig, fallbackPeriod = 'daily') {
  if (featureConfig && typeof featureConfig === 'object' && 'limit' in featureConfig) {
    return featureConfig; // already { limit, period }
  }
  // Legacy: plain number
  if (typeof featureConfig === 'number') {
    return { limit: featureConfig, period: fallbackPeriod };
  }
  return null;
}

/**
 * Update subscription limits in the database.
 */
export async function updateSubscriptionLimits(newLimits) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: 'subscription_limits', value: newLimits, updated_at: new Date().toISOString() });

    if (error) throw error;

    cachedLimits = newLimits;
    limitsLastFetched = Date.now();
    return true;
  } catch (error) {
    logger.error('SubscriptionLimits', 'Failed to update limits:', error);
    throw error;
  }
}

export async function getSubscriptionLimits() {
  return await loadLimitsFromDB();
}

// Synchronous getter using cache (for backward compat)
export const SUBSCRIPTION_LIMITS = DEFAULT_SUBSCRIPTION_LIMITS;

/**
 * Get the user's subscription tier from the database.
 */
async function getUserTier(userId) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_end_date')
      .eq('id', userId)
      .single();

    if (error || !data) return 'free';

    if (data.subscription_end_date && new Date(data.subscription_end_date) < new Date()) {
      return 'free';
    }

    return data.subscription_tier || 'free';
  } catch (error) {
    logger.error('SubscriptionLimits', 'Failed to get user tier:', error);
    return 'free';
  }
}

// ── Usage getters by period ──────────────────────────────────────────

/**
 * Get Monday of the current week (ISO week: Mon-Sun).
 */
function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon,...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().split('T')[0];
}

async function getProfileUsageData(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('daily_feature_usage, last_request_date, weekly_feature_usage, week_start_date, lifetime_feature_usage')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

function getUsageForPeriod(profile, featureType, period) {
  if (!profile) return 0;

  const today = new Date().toISOString().split('T')[0];
  const currentWeekStart = getCurrentWeekStart();

  if (period === 'lifetime') {
    const usage = profile.lifetime_feature_usage || {};
    return usage[featureType] || 0;
  }

  if (period === 'weekly') {
    // Reset if week_start_date doesn't match current week
    if (!profile.week_start_date || profile.week_start_date !== currentWeekStart) {
      return 0;
    }
    const usage = profile.weekly_feature_usage || {};
    return usage[featureType] || 0;
  }

  // daily
  if (!profile.last_request_date || profile.last_request_date !== today) {
    return 0;
  }
  const usage = profile.daily_feature_usage || {};
  return usage[featureType] || 0;
}

// ── Middleware ────────────────────────────────────────────────────────

/**
 * Creates a middleware that checks subscription limits for a given feature type.
 *
 * - Free tier: quiz/flashcard/upload = lifetime, chat = weekly
 * - Paid tiers: daily limits (or unlimited)
 * - Read/GET operations always pass through.
 */
export function checkSubscriptionLimit(featureType) {
  return async (req, res, next) => {
    try {
      // Only check limits on write operations
      if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
      }

      const userId = req.userId;
      if (!userId) {
        return next();
      }

      // requirePaidWeb (when it ran earlier in the chain) already looked the
      // tier up for this request — reuse it instead of re-querying profiles.
      const tier = req.subscriptionTier || await getUserTier(userId);
      const allLimits = await loadLimitsFromDB();
      const tierLimits = allLimits[tier] || allLimits.free || DEFAULT_SUBSCRIPTION_LIMITS.free;

      // Determine the default period for this tier if DB has legacy flat numbers
      const defaultPeriod = tier === 'free'
        ? (['quiz', 'flashcard', 'file_upload', 'chart', 'file_storage'].includes(featureType) ? 'lifetime' : 'weekly')
        : 'daily';

      const featureConfig = normalizeFeatureConfig(tierLimits[featureType], defaultPeriod)
        || normalizeFeatureConfig(tierLimits.generations, defaultPeriod) // legacy fallback
        || { limit: 10, period: defaultPeriod };

      const { limit, period } = featureConfig;

      // 0 means feature not available — short-circuit (no DB write needed).
      if (limit === 0) {
        return res.status(403).json({
          error: {
            message: `This feature requires a paid subscription.`,
            code: 'SUBSCRIPTION_REQUIRED',
            tier,
            requiredTier: 'premium',
          }
        });
      }

      let reservation;
      try {
        reservation = await reserveFeatureUsage({ userId, feature: featureType, period, limit });
      } catch (rpcError) {
        // Preserve the historical fail-open behavior during DB outages and
        // migration-first rolling deployments.
        logger.error('SubscriptionLimits', 'reserve_feature_usage failed:', rpcError);
        req.subscriptionTier = tier;
        return next();
      }
      if (!reservation.allowed) {
        const currentUsage = reservation.currentUsage ?? limit;
        const periodLabel = period === 'lifetime' ? '' : period === 'weekly' ? 'Weekly ' : 'Daily ';
        const resetHint = period === 'lifetime'
          ? 'Upgrade your plan for more.'
          : period === 'weekly'
            ? 'Resets next week. Upgrade for more.'
            : 'Resets tomorrow. Upgrade for more.';

        return res.status(429).json({
          error: {
            message: `${periodLabel}${featureType} limit reached (${currentUsage}/${limit}). ${resetHint}`,
            code: period === 'lifetime' ? 'LIFETIME_LIMIT_REACHED' : period === 'weekly' ? 'WEEKLY_LIMIT_REACHED' : 'DAILY_LIMIT_REACHED',
            tier,
            limit,
            usage: currentUsage,
            featureType,
            period,
          }
        });
      }

      req.subscriptionTier = tier;
      let terminalPromise = null;
      const settle = (outcome) => {
        if (terminalPromise) return terminalPromise;
        terminalPromise = (outcome === 'finalize'
          ? finalizeFeatureUsage(reservation.operationId).catch(async (error) => {
            await releaseFeatureUsage(reservation.operationId).catch(() => {});
            throw error;
          })
          : releaseFeatureUsage(reservation.operationId));
        return terminalPromise;
      };
      req.featureUsage = {
        operationId: reservation.operationId,
        feature: featureType,
        finalize: () => settle('finalize'),
        release: () => settle('release'),
      };
      // Conventional JSON handlers get safe outcome accounting by status. SSE
      // handlers call finalize/release explicitly before ending the stream.
      let finished = false;
      res.once('finish', () => {
        finished = true;
        settle(res.statusCode >= 200 && res.statusCode < 400 ? 'finalize' : 'release')
          .catch((error) => logger.error('SubscriptionLimits', 'Failed to settle reservation:', error));
      });
      res.once('close', () => {
        if (!finished) settle('release').catch((error) => logger.error('SubscriptionLimits', 'Failed to release disconnected reservation:', error));
      });
      next();
    } catch (error) {
      logger.error('SubscriptionLimits', `Error checking ${featureType} limit:`, error);
      // Don't block the request on limit check errors
      next();
    }
  };
}

// ── Info endpoint helpers ────────────────────────────────────────────

/**
 * Get total file count for a user.
 */
export async function getTotalFileCount(userId) {
  try {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('files')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (error) {
      logger.error('SubscriptionLimits', 'Failed to count files:', error);
      return 0;
    }
    return count || 0;
  } catch (error) {
    logger.error('SubscriptionLimits', 'Error counting files:', error);
    return 0;
  }
}

/**
 * Get subscription info for a user (used by the /subscription endpoint).
 */
export async function getSubscriptionInfo(userId) {
  const tier = await getUserTier(userId);
  const allLimits = await loadLimitsFromDB();
  const tierLimits = allLimits[tier] || allLimits.free || DEFAULT_SUBSCRIPTION_LIMITS.free;

  const profile = await getProfileUsageData(userId);
  const totalFiles = await getTotalFileCount(userId);

  // Default periods for free tier if DB has legacy flat numbers
  const defaultPeriods = {
    quiz: tier === 'free' ? 'lifetime' : 'daily',
    flashcard: tier === 'free' ? 'lifetime' : 'daily',
    file_upload: tier === 'free' ? 'lifetime' : 'daily',
    chat: tier === 'free' ? 'weekly' : 'daily',
    export: tier === 'free' ? 'weekly' : 'daily',
    chart: tier === 'free' ? 'lifetime' : 'daily',
  };

  const makeLimitInfo = (featureType) => {
    const config = normalizeFeatureConfig(tierLimits[featureType], defaultPeriods[featureType])
      || normalizeFeatureConfig(tierLimits.generations, defaultPeriods[featureType])
      || { limit: 10, period: defaultPeriods[featureType] || 'daily' };
    const used = getUsageForPeriod(profile, featureType, config.period);
    return {
      limit: config.limit,
      used,
      remaining: config.limit === -1 ? -1 : Math.max(0, config.limit - used),
      type: config.period, // 'lifetime' | 'weekly' | 'daily'
    };
  };

  const fileStorageConfig = normalizeFeatureConfig(tierLimits.file_storage, 'lifetime')
    || { limit: 10, period: 'lifetime' };

  return {
    tier,
    expiresAt: profile?.subscription_end_date || null,
    limits: {
      quiz: makeLimitInfo('quiz'),
      flashcard: makeLimitInfo('flashcard'),
      file_upload: makeLimitInfo('file_upload'),
      chat: makeLimitInfo('chat'),
      export: makeLimitInfo('export'),
      chart: makeLimitInfo('chart'),
      file_storage: {
        limit: fileStorageConfig.limit,
        used: totalFiles,
        remaining: fileStorageConfig.limit === -1 ? -1 : Math.max(0, fileStorageConfig.limit - totalFiles),
        type: 'lifetime',
      },
    },
    canView: true,
  };
}

export default { checkSubscriptionLimit, getSubscriptionInfo, getSubscriptionLimits, updateSubscriptionLimits, getTotalFileCount, SUBSCRIPTION_LIMITS };
