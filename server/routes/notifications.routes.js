import express from 'express';
const router = express.Router();
import { requireAuth, adminAuthMiddleware } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/admin.middleware.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pushNotificationService = require('../services/pushNotification.service.cjs');
import { body, query, validationResult } from 'express-validator';
// Simple console logging for now

// Get VAPID public key for web push
router.get('/vapid-key', (req, res) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BKd0G7BL7zKn7F8OVW5GWQmFPj0LpF5YnMHcG8LnZ0Q2F5R3JqCWV6V1t8LkJpX6QZ9F0M1KvQz2Q3F5R3JqCWV';
  res.json({ publicKey: vapidPublicKey });
});

// Subscribe to web push notifications
router.post('/subscribe',
  requireAuth,
  [
    body('subscription').notEmpty().isObject(),
    body('device.type').optional().equals('web'),
    body('device.browser').optional().isString(),
    body('device.os').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { subscription, device = {} } = req.body;
      const userId = req.userId;

      // Register web push subscription
      const result = await pushNotificationService.registerWebPushSubscription(
        userId,
        subscription,
        device
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error subscribing to web push:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Unsubscribe from web push notifications
router.post('/unsubscribe',
  requireAuth,
  [
    body('endpoint').notEmpty().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { endpoint } = req.body;
      const userId = req.userId;

      await pushNotificationService.unregisterWebPushSubscription(userId, endpoint);

      res.json({
        success: true,
        message: 'Unsubscribed from web push notifications'
      });
    } catch (error) {
      console.error('Error unsubscribing from web push:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Register/update push token (mobile)
router.post('/register-token',
  requireAuth,
  [
    body('token').notEmpty().withMessage('Push token is required'),
    body('deviceType').optional().isIn(['ios', 'android', 'web']),
    body('deviceInfo').optional().isObject()
  ],
  async (req, res) => {
    console.log('[Notifications/RegisterToken] === Register Token Request ===');
    console.log('[Notifications/RegisterToken] Endpoint: POST /api/notifications/register-token');
    console.log('[Notifications/RegisterToken] User:', req.userId);
    console.log('[Notifications/RegisterToken] Request body:', {
      hasToken: !!req.body.token,
      tokenLength: req.body.token?.length,
      tokenPreview: req.body.token?.substring(0, 20) + '...',
      deviceType: req.body.deviceType,
      deviceInfo: req.body.deviceInfo,
      timestamp: new Date().toISOString()
    });

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('[Notifications/RegisterToken] Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, deviceType = 'ios', deviceInfo = {} } = req.body;
      const userId = req.userId;

      const result = await pushNotificationService.registerPushToken(
        userId,
        token,
        deviceType,
        deviceInfo
      );

      console.log('[Notifications/RegisterToken] Token registered successfully:', {
        userId,
        result,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[Notifications/RegisterToken] Error registering push token:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Unregister push token
router.delete('/unregister-token',
  requireAuth,
  [
    body('token').notEmpty().withMessage('Push token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;
      const userId = req.userId;

      await pushNotificationService.unregisterPushToken(userId, token);

      res.json({
        success: true,
        message: 'Push token unregistered successfully'
      });
    } catch (error) {
      console.error('Error unregistering push token:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get notification preferences
router.get('/preferences',
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;

      // The userId here should already be a UUID from syncUser middleware
      const mappedUserId = userId; // Use req.userId which is the UUID
      
      const { data, error } = await pushNotificationService.supabase
        .from('notification_preferences')
        .select('push_enabled, email_enabled, in_app_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_enabled, frequency, categories, enabled, daily_reminder, daily_reminder_time, weekly_summary, achievement_alerts, quiz_reminders, study_streak_reminders, custom_schedules')
        .eq('user_id', mappedUserId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Return default preferences if none exist
      const preferences = data || {
        enabled: true,
        daily_reminder: true,
        daily_reminder_time: '09:00:00',
        weekly_summary: true,
        achievement_alerts: true,
        quiz_reminders: true,
        study_streak_reminders: true,
        custom_schedules: [],
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '08:00:00'
      };

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Update notification preferences
router.put('/preferences',
  requireAuth,
  [
    body('enabled').optional().isBoolean(),
    body('daily_reminder').optional().isBoolean(),
    body('daily_reminder_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    body('weekly_summary').optional().isBoolean(),
    body('achievement_alerts').optional().isBoolean(),
    body('quiz_reminders').optional().isBoolean(),
    body('study_streak_reminders').optional().isBoolean(),
    body('custom_schedules').optional().isArray(),
    body('quiet_hours_start').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    body('quiet_hours_end').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.userId;
      const preferences = req.body;

      const result = await pushNotificationService.updatePreferences(userId, preferences);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get notification history
router.get('/history',
  requireAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req, res) => {
    try {
      // Use the UUID from the user object if available, otherwise use userId
      const userId = req.user?.uuid || req.userId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      console.log('[Notifications] History endpoint - userId:', userId);
      console.log('[Notifications] History endpoint - req.user:', req.user);
      
      // Ensure we have a valid user ID
      if (!userId) {
        return res.status(400).json({ error: { message: 'User ID not found' } });
      }
      
      // Check if userId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        // If not a UUID, we need to get the UUID mapping
        console.log('[Notifications] Non-UUID format detected, getting UUID mapping for:', userId);
        
        // Get UUID from email if we have it
        if (req.user?.email) {
          const { data: profile } = await pushNotificationService.supabase
            .from('profiles')
            .select('id')
            .eq('email', req.user.email)
            .single();
            
          if (profile) {
            console.log('[Notifications] Found UUID from email:', profile.id);
            // Use the found UUID for the query
            const { data, error, count } = await pushNotificationService.supabase
              .from('notifications')
              .select('*', { count: 'exact' })
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
              .range(offset, offset + limit - 1);
              
            if (error) throw error;

            // Transform data for frontend
            const notifications = (data || []).map(n => ({
              id: n.id,
              type: n.data?.type || 'general',
              title: n.title,
              body: n.body,
              data: n.data || {},
              read: false, // We don't have a read field in notifications table yet
              createdAt: n.sent_at || n.created_at
            }));

            // Count unread - for now return 0 since we don't track read status yet
            const unreadCount = 0;

            res.json({
              success: true,
              notifications,
              unreadCount,
              pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
              }
            });
            
            return; // Exit early after successful response
          }
        }
        
        // If we couldn't find a UUID mapping, return error
        return res.status(400).json({
          error: { message: 'Unable to find user profile. Please ensure you are logged in.' }
        });
      }

      // The userId here should already be a UUID from syncUser middleware
      const mappedUserId = userId; // Use req.userId which is the UUID
      
      const { data, error, count } = await pushNotificationService.supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', mappedUserId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Transform data for frontend
      const notifications = (data || []).map(n => ({
        id: n.id,
        type: n.data?.type || 'general',
        title: n.title,
        body: n.body,
        data: n.data || {},
        read: false, // We don't have a read field in notifications table yet
        createdAt: n.sent_at || n.created_at
      }));

      // Count unread - for now return 0 since we don't track read status yet
      const unreadCount = 0;

      res.json({
        success: true,
        notifications,
        unreadCount: unreadCount || 0,
        pagination: {
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: offset + limit < (count || 0)
        }
      });
    } catch (error) {
      console.error('Error getting notification history:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Mark notification as read
router.post('/:notificationId/read',
  requireAuth,
  async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.userId;
      const mappedUserId = userId;

      const { error } = await pushNotificationService.supabase
        .from('notification_history')
        .update({ read: true })
        .match({ 
          id: notificationId,
          user_id: mappedUserId
        });

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Mark all notifications as read
router.post('/read-all',
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const mappedUserId = userId;

      const { error } = await pushNotificationService.supabase
        .from('notification_history')
        .update({ read: true })
        .eq('user_id', mappedUserId)
        .eq('read', false);

      if (error) throw error;

      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get notification stats
router.get('/stats',
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.userId;
      const stats = await pushNotificationService.getUserStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin routes
// Send notification to specific user
router.post('/send',
  requireAuth,
  requireAdmin,
  [
    body('userId').notEmpty().isUUID(),
    body('title').notEmpty(),
    body('body').notEmpty(),
    body('data').optional().isObject(),
    body('priority').optional().isIn(['default', 'high'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, title, body, data, priority } = req.body;

      const result = await pushNotificationService.sendToUser(userId, {
        title,
        body,
        data,
        priority
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Send notification to segment
router.post('/send-segment',
  requireAuth,
  requireAdmin,
  [
    body('segment').notEmpty().isIn(['all', 'active', 'inactive', 'custom']),
    body('filters').optional().isObject(),
    body('title').notEmpty(),
    body('body').notEmpty(),
    body('data').optional().isObject(),
    body('priority').optional().isIn(['default', 'high'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { segment, filters, title, body, data, priority } = req.body;

      const result = await pushNotificationService.sendToSegment(
        segment,
        filters || {},
        { title, body, data, priority }
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error sending segment notification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Create notification campaign
router.post('/campaigns',
  requireAuth,
  requireAdmin,
  [
    body('name').notEmpty(),
    body('template_id').optional().isUUID(),
    body('custom_title').optional(),
    body('custom_body').optional(),
    body('custom_data').optional().isObject(),
    body('target_segment').notEmpty().isIn(['all', 'active', 'inactive', 'custom']),
    body('target_filters').optional().isObject(),
    body('scheduled_at').optional().isISO8601()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const campaign = {
        ...req.body,
        created_by: req.admin.id,
        status: req.body.scheduled_at ? 'scheduled' : 'draft'
      };

      const { data, error } = await pushNotificationService.supabase
        .from('notification_campaigns')
        .insert(campaign)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get notification templates
router.get('/templates',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const { data, error } = await pushNotificationService.supabase
        .from('notification_templates')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Create notification template
router.post('/templates',
  requireAuth,
  requireAdmin,
  [
    body('name').notEmpty(),
    body('title').notEmpty(),
    body('body').notEmpty(),
    body('category').notEmpty(),
    body('data').optional().isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const template = {
        ...req.body,
        created_by: req.admin.id
      };

      const { data, error } = await pushNotificationService.supabase
        .from('notification_templates')
        .insert(template)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Get notification statistics
router.get('/admin/stats',
  adminAuthMiddleware,
  async (req, res) => {
    try {
      // Get total users
      const { count: totalUsers } = await pushNotificationService.supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get users with push tokens
      const { count: usersWithTokens } = await pushNotificationService.supabase
        .from('push_tokens')
        .select('*', { count: 'exact', head: true });

      // Get notifications sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: notificationsSentToday } = await pushNotificationService.supabase
        .from('notification_history')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', today.toISOString());

      // Get notifications sent this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: notificationsSentWeek } = await pushNotificationService.supabase
        .from('notification_history')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', weekAgo.toISOString());

      // Get pending notifications
      const { count: pendingNotifications } = await pushNotificationService.supabase
        .from('scheduled_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      res.json({
        total_users: totalUsers || 0,
        users_with_tokens: usersWithTokens || 0,
        notifications_sent_today: notificationsSentToday || 0,
        notifications_sent_week: notificationsSentWeek || 0,
        pending_notifications: pendingNotifications || 0
      });
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Get notification templates
router.get('/admin/templates',
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { data: templates, error } = await pushNotificationService.supabase
        .from('notification_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({
        success: true,
        templates: templates || []
      });
    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Update notification template
router.put('/admin/templates/:id',
  adminAuthMiddleware,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = {
        name: req.body.name,
        title: req.body.title,
        body: req.body.body,
        data: req.body.data || {},
        updated_at: new Date().toISOString()
      };

      const { data, error } = await pushNotificationService.supabase
        .from('notification_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Delete notification template
router.delete('/admin/templates/:id',
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await pushNotificationService.supabase
        .from('notification_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Get scheduled notifications
router.get('/admin/scheduled',
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { data: notifications, error } = await pushNotificationService.supabase
        .from('scheduled_notifications')
        .select('*')
        .order('scheduled_for', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        notifications: notifications || []
      });
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Cancel scheduled notification
router.post('/admin/scheduled/:id/cancel',
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { data, error } = await pushNotificationService.supabase
        .from('scheduled_notifications')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found or already processed'
        });
      }

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('Error cancelling notification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin route: Send notification
router.post('/admin/send',
  adminAuthMiddleware,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('segment').isIn(['all', 'active', 'inactive', 'specific']).withMessage('Invalid segment')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, body, data = {}, segment, userIds, userEmails, scheduledFor } = req.body;
      
      // Convert emails to user IDs if emails are provided
      let finalUserIds = userIds;
      if (userEmails && userEmails.length > 0) {
        const { data: users, error: userError } = await pushNotificationService.supabase
          .from('profiles')
          .select('id, email')
          .in('email', userEmails);
          
        if (userError) {
          console.error('Error fetching users by email:', userError);
          return res.status(400).json({
            success: false,
            error: 'Failed to find users with provided emails'
          });
        }
        
        if (!users || users.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No users found with the provided emails'
          });
        }
        
        // Map emails to user IDs
        finalUserIds = users.map(user => user.id);
        
        // Log which emails were found/not found
        const foundEmails = users.map(u => u.email);
        const notFoundEmails = userEmails.filter(email => !foundEmails.includes(email));
        
        if (notFoundEmails.length > 0) {
          console.log(`[Notifications] Emails not found: ${notFoundEmails.join(', ')}`);
        }
      }

      // If scheduled for later
      if (scheduledFor) {
        const { data: scheduled, error } = await pushNotificationService.supabase
          .from('scheduled_notifications')
          .insert({
            custom_title: title,
            custom_body: body,
            custom_data: data,
            segment,
            user_ids: finalUserIds,
            scheduled_for: scheduledFor,
            status: 'pending',
            created_by: req.admin.id
          })
          .select()
          .single();

        if (error) throw error;

        return res.json({
          success: true,
          message: 'Notification scheduled successfully',
          data: scheduled
        });
      }

      // Send immediately based on segment
      let result;
      if (segment === 'specific' && finalUserIds && finalUserIds.length > 0) {
        console.log(`[Notifications] Sending to specific users: ${finalUserIds.join(', ')}`);
        result = await pushNotificationService.sendToUsers(finalUserIds, title, body, data);
      } else {
        console.log(`[Notifications] Sending to segment: ${segment}`);
        result = await pushNotificationService.sendToSegment(segment, title, body, data);
      }

      console.log('[Notifications] Send result:', result);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Clear all notifications for the user
router.delete('/clear',
  requireAuth,
  async (req, res) => {
    try {
      // Use the UUID from the user object if available, otherwise use userId
      const userId = req.user?.uuid || req.userId;
      
      console.log('[Notifications] Clear endpoint - userId:', userId);
      
      // If not a UUID, get the UUID from email
      let userUuid = userId;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(userId) && req.user?.email) {
        const { data: profile } = await pushNotificationService.supabase
          .from('profiles')
          .select('id')
          .eq('email', req.user.email)
          .single();
          
        if (profile) {
          userUuid = profile.id;
        } else {
          return res.status(400).json({
            error: { message: 'Unable to find user profile' }
          });
        }
      }
      
      // Delete all notifications for this user
      const { error } = await pushNotificationService.supabase
        .from('notifications')
        .delete()
        .eq('user_id', userUuid);
      
      if (error) throw error;
      
      res.json({
        success: true,
        message: 'All notifications cleared'
      });
    } catch (error) {
      console.error('Error clearing notifications:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;