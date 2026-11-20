import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';

// Configuration
const MAX_NOTIFICATIONS_PER_RECIPIENT_PER_DAY = 10;
const MAX_NOTIFICATIONS_PER_RECIPIENT_PER_HOUR = 3;
const COOLDOWN_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache for quick checks (reset on server restart)
const recipientCache = new Map();

// Clean up old cache entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of recipientCache.entries()) {
    if (now - data.lastReset > COOLDOWN_PERIOD_MS) {
      recipientCache.delete(key);
    }
  }
}, 60 * 60 * 1000);

/**
 * Check if a recipient has exceeded their notification limits
 * This prevents notification bombing by checking limits across ALL senders
 */
export const checkRecipientNotificationLimit = async (recipientEmail) => {
  const now = Date.now();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - COOLDOWN_PERIOD_MS).toISOString();
  
  try {
    const supabase = getSupabase();
    
    // Check daily limit across all senders
    const { count: dailyCount } = await supabase
      .from('share_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', recipientEmail)
      .eq('notification_sent', true)
      .gte('shared_at', oneDayAgo);
      
    if (dailyCount >= MAX_NOTIFICATIONS_PER_RECIPIENT_PER_DAY) {
      logger.warn('RecipientRateLimit', `Daily limit exceeded for ${recipientEmail}: ${dailyCount}/${MAX_NOTIFICATIONS_PER_RECIPIENT_PER_DAY}`);
      return {
        allowed: false,
        reason: 'daily_limit',
        limit: MAX_NOTIFICATIONS_PER_RECIPIENT_PER_DAY,
        resetTime: new Date(now + COOLDOWN_PERIOD_MS).toISOString()
      };
    }
    
    // Check hourly limit for burst protection
    const { count: hourlyCount } = await supabase
      .from('share_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', recipientEmail)
      .eq('notification_sent', true)
      .gte('shared_at', oneHourAgo);
      
    if (hourlyCount >= MAX_NOTIFICATIONS_PER_RECIPIENT_PER_HOUR) {
      logger.warn('RecipientRateLimit', `Hourly limit exceeded for ${recipientEmail}: ${hourlyCount}/${MAX_NOTIFICATIONS_PER_RECIPIENT_PER_HOUR}`);
      return {
        allowed: false,
        reason: 'hourly_limit',
        limit: MAX_NOTIFICATIONS_PER_RECIPIENT_PER_HOUR,
        resetTime: new Date(now + 60 * 60 * 1000).toISOString()
      };
    }
    
    // Update cache
    recipientCache.set(recipientEmail, {
      dailyCount,
      hourlyCount,
      lastCheck: now,
      lastReset: now
    });
    
    return {
      allowed: true,
      dailyCount,
      hourlyCount,
      dailyRemaining: MAX_NOTIFICATIONS_PER_RECIPIENT_PER_DAY - dailyCount,
      hourlyRemaining: MAX_NOTIFICATIONS_PER_RECIPIENT_PER_HOUR - hourlyCount
    };
    
  } catch (error) {
    logger.error('RecipientRateLimit', 'Failed to check recipient limits:', error);
    // On error, be conservative and allow (to not break functionality)
    return { allowed: true, error: true };
  }
};

/**
 * Express middleware for recipient rate limiting
 */
export const recipientRateLimitMiddleware = async (req, res, next) => {
  // Only apply to send-to-friend endpoint
  if (req.path !== '/send-to-friend') {
    return next();
  }
  
  const recipientEmail = req.body?.recipientEmail;
  if (!recipientEmail) {
    return next();
  }
  
  const limitCheck = await checkRecipientNotificationLimit(recipientEmail);
  
  if (!limitCheck.allowed) {
    const message = limitCheck.reason === 'daily_limit' 
      ? `This recipient has received too many notifications today (${limitCheck.limit} max per day). Please try again tomorrow.`
      : `This recipient has received too many notifications recently (${limitCheck.limit} max per hour). Please try again later.`;
      
    return res.status(429).json({
      success: false,
      error: 'recipient_rate_limit',
      message,
      resetTime: limitCheck.resetTime,
      limit: limitCheck.limit,
      reason: limitCheck.reason
    });
  }
  
  // Attach limit info to request for logging
  req.recipientLimits = limitCheck;
  next();
};

/**
 * Get recipient notification statistics (for admin dashboard)
 */
export const getRecipientStats = async (recipientEmail) => {
  const supabase = getSupabase();
  const now = new Date();
  
  const [
    { count: totalDay },
    { count: totalHour },
    { data: recentSenders }
  ] = await Promise.all([
    // Total in last 24 hours
    supabase
      .from('share_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', recipientEmail)
      .eq('notification_sent', true)
      .gte('shared_at', new Date(now - 24 * 60 * 60 * 1000).toISOString()),
      
    // Total in last hour
    supabase
      .from('share_tracking')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_email', recipientEmail)
      .eq('notification_sent', true)
      .gte('shared_at', new Date(now - 60 * 60 * 1000).toISOString()),
      
    // Recent senders
    supabase
      .from('share_tracking')
      .select('sender_id, shared_at')
      .eq('recipient_email', recipientEmail)
      .eq('notification_sent', true)
      .gte('shared_at', new Date(now - 24 * 60 * 60 * 1000).toISOString())
      .order('shared_at', { ascending: false })
      .limit(10)
  ]);
  
  return {
    recipientEmail,
    dailyCount: totalDay,
    hourlyCount: totalHour,
    dailyLimit: MAX_NOTIFICATIONS_PER_RECIPIENT_PER_DAY,
    hourlyLimit: MAX_NOTIFICATIONS_PER_RECIPIENT_PER_HOUR,
    recentSenders: recentSenders || []
  };
};

export default recipientRateLimitMiddleware;