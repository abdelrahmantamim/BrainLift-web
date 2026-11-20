const { Expo } = require('expo-server-sdk');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const webpush = require('web-push');
// Simple console logging for now

// Dynamic imports for ES modules
let getSupabase, getDatabase;
(async () => {
  const servicesConfig = await import('../config/services.config.js');
  const databaseConfig = await import('../config/database.config.js');
  getSupabase = servicesConfig.getSupabase;
  getDatabase = databaseConfig.getDatabase;
})();

// Create a new Expo SDK client
const expo = new Expo();

// Configure web-push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'admin@brainlift.app'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

class PushNotificationService {
  constructor() {
    this._supabase = null;
    this._pool = null;
    this.idMappingCache = new Map();
  }

  get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabase();
    }
    return this._supabase;
  }

  get pool() {
    if (!this._pool) {
      // Create PostgreSQL pool directly
      this._pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
    }
    return this._pool;
  }

  /**
   * Get or create UUID mapping for Better Auth ID
   */
  async getOrCreateUUID(betterAuthId) {
    if (!betterAuthId) return null;
    
    // Check if it's already a UUID
    if (betterAuthId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return betterAuthId;
    }
    
    // Check cache first
    if (this.idMappingCache.has(betterAuthId)) {
      return this.idMappingCache.get(betterAuthId);
    }
    
    try {
      // Check for existing mapping
      const existingMapping = await this.pool.query(
        'SELECT uuid FROM auth_id_mapping WHERE better_auth_id = $1',
        [betterAuthId]
      );
      
      if (existingMapping.rows.length > 0) {
        const uuid = existingMapping.rows[0].uuid;
        this.idMappingCache.set(betterAuthId, uuid);
        return uuid;
      }
      
      // Create new mapping
      const newUuid = uuidv4();
      await this.pool.query(
        'INSERT INTO auth_id_mapping (better_auth_id, uuid) VALUES ($1, $2)',
        [betterAuthId, newUuid]
      );
      
      this.idMappingCache.set(betterAuthId, newUuid);
      return newUuid;
    } catch (error) {
      console.error('[PushNotification] Error managing ID mapping:', error);
      return uuidv4();
    }
  }

  /**
   * Register or update a push token for a user
   */
  async registerPushToken(userId, token, deviceType = 'ios', deviceInfo = {}) {
    try {
      // Validate the push token
      if (!Expo.isExpoPushToken(token)) {
        throw new Error('Invalid Expo push token');
      }

      // Get or create UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);

      // Upsert the push token
      const { data, error } = await this.supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: mappedUserId,
            token,
            device_type: deviceType,
            device_info: deviceInfo,
            is_active: true,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'token',
            returning: true
          }
        )
        .select()
        .single();

      if (error) throw error;

      console.info(`Push token registered for user ${userId} (UUID: ${mappedUserId})`);
      return data;
    } catch (error) {
      console.error('Error registering push token:', error);
      throw error;
    }
  }

  /**
   * Unregister a push token
   */
  async unregisterPushToken(userId, token) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      const { error } = await this.supabase
        .from('push_tokens')
        .update({ is_active: false })
        .match({ user_id: mappedUserId, token });

      if (error) throw error;

      console.info(`Push token unregistered for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error unregistering push token:', error);
      throw error;
    }
  }

  /**
   * Send a notification to a single user
   */
  async sendToUser(userId, { title, body, data = {}, priority = 'default' }) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      // Get active push tokens for the user
      const { data: tokens, error } = await this.supabase
        .from('push_tokens')
        .select('*')
        .match({ user_id: mappedUserId, is_active: true });

      if (error) throw error;
      if (!tokens || tokens.length === 0) {
        console.warn(`No active push tokens found for user ${userId} (UUID: ${mappedUserId})`);
        return { sent: 0, failed: 0 };
      }

      // Prepare messages
      const messages = tokens.map(token => ({
        to: token.token,
        sound: 'default',
        title,
        body,
        data: {
          ...data,
          userId,
          timestamp: new Date().toISOString()
        },
        priority,
        channelId: data.channelId || 'default'
      }));

      // Send notifications
      const results = await this.sendBatch(messages);
      
      // Log the notifications
      await this.logNotifications(mappedUserId, tokens, { title, body, data }, results);

      return results;
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  }

  /**
   * Send notifications in batches
   */
  async sendBatch(messages) {
    try {
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
      let sent = 0;
      let failed = 0;

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          
          // Count successes and failures
          ticketChunk.forEach(ticket => {
            if (ticket.status === 'ok') {
              sent++;
            } else {
              failed++;
              console.error(`Push notification failed: ${ticket.message}`);
            }
          });
        } catch (error) {
          console.error('Error sending notification chunk:', error);
          failed += chunk.length;
        }
      }

      return { sent, failed, tickets };
    } catch (error) {
      console.error('Error in sendBatch:', error);
      throw error;
    }
  }

  /**
   * Send notification to a segment of users
   */
  async sendToSegment(segment, title, body, data = {}) {
    try {
      let query = this.supabase
        .from('push_tokens')
        .select('*, profiles!inner(*)')
        .eq('is_active', true);

      // Apply segment filters
      switch (segment) {
        case 'active':
          // Users active in last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          query = query.gte('profiles.last_active_at', sevenDaysAgo.toISOString());
          break;
        
        case 'inactive':
          // Users inactive for more than 7 days
          const inactiveDate = new Date();
          inactiveDate.setDate(inactiveDate.getDate() - 7);
          query = query.lt('profiles.last_active_at', inactiveDate.toISOString());
          break;
        
        case 'custom':
          // Apply custom filters
          if (filters.last_active_days) {
            const customDate = new Date();
            customDate.setDate(customDate.getDate() - filters.last_active_days);
            query = query.gte('profiles.last_active_at', customDate.toISOString());
          }
          if (filters.min_sessions) {
            query = query.gte('profiles.total_sessions', filters.min_sessions);
          }
          break;
      }

      const { data: tokens, error } = await query;
      if (error) throw error;

      if (!tokens || tokens.length === 0) {
        console.warn(`No users found for segment: ${segment}`);
        return { sent: 0, failed: 0, targetUsers: 0 };
      }

      // Prepare messages
      const messages = tokens.map(token => ({
        to: token.token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
        priority: 'high'
      }));

      // Send notifications
      const results = await this.sendBatch(messages);
      
      return {
        ...results,
        targetUsers: tokens.length
      };
    } catch (error) {
      console.error('Error sending to segment:', error);
      throw error;
    }
  }

  /**
   * Send notification to specific users by their IDs
   */
  async sendToUsers(userIds, title, body, data = {}) {
    try {
      // Map all user IDs to UUIDs
      const mappedUserIds = await Promise.all(
        userIds.map(id => this.getOrCreateUUID(id))
      );
      
      // Get push tokens for the specified users
      const { data: tokens, error } = await this.supabase
        .from('push_tokens')
        .select('*')
        .in('user_id', mappedUserIds)
        .eq('is_active', true);

      if (error) throw error;

      if (!tokens || tokens.length === 0) {
        console.warn('No push tokens found for specified users');
        return { sent: 0, failed: 0, targetUsers: userIds.length, tokensFound: 0 };
      }

      console.log(`[PushNotification] Found ${tokens.length} tokens for ${userIds.length} users`);

      // Prepare messages
      const messages = tokens.map(token => ({
        to: token.token,
        sound: 'default',
        title: title,
        body: body,
        data: data,
        priority: 'high'
      }));

      // Send notifications
      const results = await this.sendBatch(messages);
      
      // Save to history
      for (let i = 0; i < tokens.length; i++) {
        await this.supabase
          .from('notification_history')
          .insert({
            user_id: tokens[i].user_id,
            push_token_id: tokens[i].id,
            title,
            body,
            data,
            status: results.successful > i ? 'sent' : 'failed'
          });
      }
      
      return {
        ...results,
        targetUsers: userIds.length,
        tokensFound: tokens.length
      };
    } catch (error) {
      console.error('Error sending to users:', error);
      throw error;
    }
  }

  /**
   * Schedule a notification for later
   */
  async scheduleNotification(userId, notification, scheduledFor) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      const { data, error } = await this.supabase
        .from('notification_queue')
        .insert({
          user_id: mappedUserId,
          notification_type: notification.type || 'custom',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: notification.priority || 5,
          scheduled_for: scheduledFor,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      console.info(`Notification scheduled for user ${userId} at ${scheduledFor}`);
      return data;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications() {
    try {
      // Get pending notifications that are due
      const { data: notifications, error } = await this.supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!notifications || notifications.length === 0) return;

      console.info(`Processing ${notifications.length} scheduled notifications`);

      for (const notification of notifications) {
        try {
          // Update status to processing
          await this.supabase
            .from('notification_queue')
            .update({ 
              status: 'processing',
              last_attempt_at: new Date().toISOString(),
              attempts: notification.attempts + 1
            })
            .eq('id', notification.id);

          // Send the notification
          await this.sendToUser(notification.user_id, {
            title: notification.title,
            body: notification.body,
            data: notification.data
          });

          // Mark as sent
          await this.supabase
            .from('notification_queue')
            .update({ status: 'sent' })
            .eq('id', notification.id);
        } catch (error) {
          console.error(`Failed to process notification ${notification.id}:`, error);
          
          // Mark as failed if too many attempts
          if (notification.attempts >= 3) {
            await this.supabase
              .from('notification_queue')
              .update({ 
                status: 'failed',
                error_message: error.message
              })
              .eq('id', notification.id);
          } else {
            // Reset to pending for retry
            await this.supabase
              .from('notification_queue')
              .update({ 
                status: 'pending',
                error_message: error.message
              })
              .eq('id', notification.id);
          }
        }
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
      throw error;
    }
  }

  /**
   * Send daily reminder notifications
   */
  async sendDailyReminders() {
    try {
      const currentHour = new Date().getHours();
      const currentTime = `${currentHour.toString().padStart(2, '0')}:00:00`;

      // Get users who should receive reminders at this hour
      const { data: users, error } = await this.supabase
        .from('notification_preferences')
        .select('user_id, profiles!inner(*)')
        .eq('enabled', true)
        .eq('daily_reminder', true)
        .eq('daily_reminder_time', currentTime);

      if (error) throw error;
      if (!users || users.length === 0) return;

      console.info(`Sending daily reminders to ${users.length} users`);

      // Get the daily reminder template
      const { data: template } = await this.supabase
        .from('notification_templates')
        .select('*')
        .eq('name', 'daily_reminder')
        .single();

      for (const user of users) {
        await this.sendToUser(user.user_id, {
          title: template.title,
          body: template.body,
          data: {
            type: 'daily_reminder',
            ...template.data
          }
        });
      }
    } catch (error) {
      console.error('Error sending daily reminders:', error);
      throw error;
    }
  }

  /**
   * Log notification attempts and results
   */
  async logNotifications(userId, tokens, notification, results) {
    try {
      const logs = tokens.map((token, index) => ({
        user_id: userId,
        push_token_id: token.id,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        status: results.tickets?.[index]?.status === 'ok' ? 'sent' : 'failed',
        error_message: results.tickets?.[index]?.message,
        sent_at: new Date().toISOString()
      }));

      const { error } = await this.supabase
        .from('notification_logs')
        .insert(logs);

      if (error) throw error;
    } catch (error) {
      console.error('Error logging notifications:', error);
      // Don't throw - logging failure shouldn't prevent notification sending
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(userId, preferences) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: mappedUserId,
            ...preferences,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'user_id'
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   */
  async getUserStats(userId) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      const { data, error } = await this.supabase
        .rpc('get_user_notification_stats', { p_user_id: mappedUserId });

      if (error) throw error;
      return data[0] || {
        total_sent: 0,
        total_opened: 0,
        open_rate: 0,
        last_notification_at: null
      };
    } catch (error) {
      console.error('Error getting user notification stats:', error);
      throw error;
    }
  }

  /**
   * Register a web push subscription
   */
  async registerWebPushSubscription(userId, subscription, device = {}) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      // Extract subscription details
      const { endpoint, keys } = subscription;
      
      // Upsert the web push subscription
      const { data, error } = await this.supabase
        .from('push_tokens')
        .upsert(
          {
            user_id: mappedUserId,
            token: endpoint, // Use endpoint as token for web push
            device_type: 'web',
            device_info: {
              ...device,
              subscription: {
                endpoint,
                keys
              }
            },
            is_active: true,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'token',
            returning: true
          }
        )
        .select()
        .single();

      if (error) throw error;

      console.info(`Web push subscription registered for user ${userId} (UUID: ${mappedUserId})`);
      return data;
    } catch (error) {
      console.error('Error registering web push subscription:', error);
      throw error;
    }
  }

  /**
   * Unregister a web push subscription
   */
  async unregisterWebPushSubscription(userId, endpoint) {
    try {
      // Get UUID for the user ID
      const mappedUserId = await this.getOrCreateUUID(userId);
      
      const { error } = await this.supabase
        .from('push_tokens')
        .update({ is_active: false })
        .match({ 
          user_id: mappedUserId, 
          token: endpoint,
          device_type: 'web'
        });

      if (error) throw error;

      console.info(`Web push subscription unregistered for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Error unregistering web push subscription:', error);
      throw error;
    }
  }

  /**
   * Send a web push notification
   */
  async sendWebPushNotification(subscription, notification) {
    try {
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/icon-96x96.png',
        image: notification.image,
        tag: notification.tag || 'brainlift-notification',
        data: notification.data || {},
        actions: notification.actions || [],
        requireInteraction: notification.requireInteraction || false,
        timestamp: Date.now()
      });

      await webpush.sendNotification(subscription, payload);
      return { success: true };
    } catch (error) {
      console.error('Error sending web push notification:', error);
      
      // Check if the error is due to an invalid subscription
      if (error.statusCode === 410) {
        // Subscription is no longer valid
        return { success: false, shouldRemove: true };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Override sendBatch to handle both Expo and Web Push
   */
  async sendBatch(messages) {
    try {
      const expoMessages = [];
      const webPushMessages = [];
      
      // Separate expo and web push messages
      for (const message of messages) {
        if (message.to.startsWith('http')) {
          // Web push endpoint
          webPushMessages.push(message);
        } else if (Expo.isExpoPushToken(message.to)) {
          // Expo push token
          expoMessages.push(message);
        }
      }
      
      let sent = 0;
      let failed = 0;
      const tickets = [];
      
      // Send Expo notifications
      if (expoMessages.length > 0) {
        const chunks = expo.chunkPushNotifications(expoMessages);
        
        for (const chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            tickets.push(...ticketChunk);
            
            // Count successes and failures
            ticketChunk.forEach(ticket => {
              if (ticket.status === 'ok') {
                sent++;
              } else {
                failed++;
                console.error(`Push notification failed: ${ticket.message}`);
              }
            });
          } catch (error) {
            console.error('Error sending notification chunk:', error);
            failed += chunk.length;
          }
        }
      }
      
      // Send Web Push notifications
      for (const message of webPushMessages) {
        try {
          // Extract subscription from device_info
          const tokenData = await this.supabase
            .from('push_tokens')
            .select('device_info')
            .eq('token', message.to)
            .single();
            
          if (tokenData.data?.device_info?.subscription) {
            const result = await this.sendWebPushNotification(
              tokenData.data.device_info.subscription,
              {
                title: message.title,
                body: message.body,
                data: message.data,
                tag: message.data?.tag,
                icon: message.data?.icon,
                badge: message.data?.badge,
                actions: message.data?.actions,
                requireInteraction: message.priority === 'high'
              }
            );
            
            if (result.success) {
              sent++;
              tickets.push({ status: 'ok' });
            } else {
              failed++;
              tickets.push({ status: 'error', message: result.error });
              
              // Remove invalid subscriptions
              if (result.shouldRemove) {
                await this.supabase
                  .from('push_tokens')
                  .update({ is_active: false })
                  .eq('token', message.to);
              }
            }
          } else {
            failed++;
            tickets.push({ status: 'error', message: 'Subscription not found' });
          }
        } catch (error) {
          console.error('Error sending web push notification:', error);
          failed++;
          tickets.push({ status: 'error', message: error.message });
        }
      }

      return { sent, failed, tickets };
    } catch (error) {
      console.error('Error in sendBatch:', error);
      throw error;
    }
  }
}

module.exports = new PushNotificationService();