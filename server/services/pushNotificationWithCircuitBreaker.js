import { createRequire } from 'module';
import { withCircuitBreaker } from './circuitBreaker.service.js';
import logger from '../utils/serverLogger.js';

const require = createRequire(import.meta.url);
const pushNotificationService = require('./pushNotification.service.cjs');

/**
 * Wrapper for push notification service with circuit breaker protection
 */
class PushNotificationServiceWithCircuitBreaker {
  constructor() {
    this.service = pushNotificationService;
  }

  /**
   * Send notification with circuit breaker protection
   */
  async sendNotification(userId, notification) {
    const protectedSend = withCircuitBreaker('notifications', async () => {
      return await this.service.sendNotification(userId, notification);
    });

    try {
      return await protectedSend();
    } catch (error) {
      if (error.code === 'CIRCUIT_OPEN') {
        logger.warn('PushNotification', 'Circuit breaker open, notification queued for later');
        // Queue the notification for retry
        await this.queueNotification(userId, notification);
        return { queued: true, reason: 'circuit_breaker_open' };
      }
      throw error;
    }
  }

  /**
   * Send to multiple users with circuit breaker
   */
  async sendToMultipleUsers(userIds, notification) {
    const protectedSend = withCircuitBreaker('notifications', async () => {
      return await this.service.sendToMultipleUsers(userIds, notification);
    });

    try {
      return await protectedSend();
    } catch (error) {
      if (error.code === 'CIRCUIT_OPEN') {
        logger.warn('PushNotification', 'Circuit breaker open, batch notification queued');
        // Queue notifications for retry
        for (const userId of userIds) {
          await this.queueNotification(userId, notification);
        }
        return { queued: true, count: userIds.length, reason: 'circuit_breaker_open' };
      }
      throw error;
    }
  }

  /**
   * Queue notification for later delivery
   */
  async queueNotification(userId, notification) {
    try {
      const { getSupabase } = await import('../config/services.config.js');
      const supabase = getSupabase();
      
      await supabase.from('notification_queue').insert({
        user_id: userId,
        notification: notification,
        status: 'pending',
        retry_count: 0,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error('PushNotification', 'Failed to queue notification:', error);
    }
  }

  /**
   * Process queued notifications (called by a cron job)
   */
  async processQueuedNotifications() {
    try {
      const { getSupabase } = await import('../config/services.config.js');
      const supabase = getSupabase();
      
      // Get pending notifications
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lt('retry_count', 3)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error || !notifications) return;

      for (const item of notifications) {
        try {
          // Try to send with circuit breaker
          await this.sendNotification(item.user_id, item.notification);
          
          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', item.id);
        } catch (error) {
          // Increment retry count
          await supabase
            .from('notification_queue')
            .update({ 
              retry_count: item.retry_count + 1,
              last_error: error.message
            })
            .eq('id', item.id);
        }
      }
    } catch (error) {
      logger.error('PushNotification', 'Failed to process queued notifications:', error);
    }
  }

  // Delegate other methods to the original service
  registerPushToken(userId, token, platform) {
    return this.service.registerPushToken(userId, token, platform);
  }

  unregisterPushToken(userId, token) {
    return this.service.unregisterPushToken(userId, token);
  }

  getUserPushTokens(userId) {
    return this.service.getUserPushTokens(userId);
  }

  testNotification(userId) {
    return this.sendNotification(userId, {
      title: 'Test Notification',
      body: 'This is a test notification from BrainLift!',
      data: { type: 'test' }
    });
  }
}

// Create and export singleton instance
const pushNotificationServiceWithCircuitBreaker = new PushNotificationServiceWithCircuitBreaker();
export default pushNotificationServiceWithCircuitBreaker;