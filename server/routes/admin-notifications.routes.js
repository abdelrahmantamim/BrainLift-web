import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { sendPushNotification } from '../services/pushNotificationWrapper.js';

const router = express.Router();

// Get all notifications with pagination
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { page = 1, limit = 20, status = '', userId = '' } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    const { data: notifications, error, count } = await query;
    
    if (error) throw error;
    
    // Get user details for notifications
    const userIds = [...new Set(notifications.map(n => n.user_id))];
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);
    
    const userMap = users?.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {}) || {};
    
    const notificationsWithUsers = notifications.map(notification => ({
      ...notification,
      user: userMap[notification.user_id] || null
    }));
    
    res.json({
      notifications: notificationsWithUsers,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Admin Notifications] Error fetching notifications:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch notifications' }
    });
  }
});

// Send notification to specific users or all users
router.post('/send', requireAdminAuth, async (req, res) => {
  try {
    const { title, body, data = {}, segment = 'all', userEmails = [], scheduledFor } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({
        error: { message: 'Title and body are required' }
      });
    }
    
    const supabase = getSupabase();
    
    // Determine target users based on segment
    let targetUsers = [];
    
    if (segment === 'specific' && userEmails.length > 0) {
      // Get users by email
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, push_token')
        .in('email', userEmails)
        .not('push_token', 'is', null);
        
      if (error) throw error;
      targetUsers = users || [];
    } else if (segment === 'active') {
      // Get active users (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, push_token')
        .gte('last_seen', sevenDaysAgo.toISOString())
        .not('push_token', 'is', null);
        
      if (error) throw error;
      targetUsers = users || [];
    } else if (segment === 'inactive') {
      // Get inactive users (7+ days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, push_token')
        .lt('last_seen', sevenDaysAgo.toISOString())
        .not('push_token', 'is', null);
        
      if (error) throw error;
      targetUsers = users || [];
    } else {
      // Get all users with push tokens
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, email, push_token')
        .not('push_token', 'is', null);
        
      if (error) throw error;
      targetUsers = users || [];
    }
    
    if (targetUsers.length === 0) {
      // Check if users exist but don't have push tokens
      let usersWithoutTokens = 0;
      
      if (segment === 'specific' && userEmails.length > 0) {
        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id')
          .in('email', userEmails);
        usersWithoutTokens = (allUsers?.length || 0) - targetUsers.length;
      }
      
      const message = usersWithoutTokens > 0 
        ? `Found ${usersWithoutTokens} user(s) but they haven't registered for push notifications yet. Users need to open the mobile app to register.`
        : 'No users found with push tokens for the selected segment';
        
      return res.status(404).json({
        error: { message }
      });
    }
    
    // If scheduled, create scheduled notifications and return
    if (scheduledFor) {
      const scheduledNotifications = targetUsers.map(user => ({
        user_id: user.id,
        custom_title: title,
        custom_body: body,
        scheduled_for: scheduledFor,
        segment,
        status: 'pending'
      }));
      
      const { error: scheduleError } = await supabase
        .from('scheduled_notifications')
        .insert(scheduledNotifications);
        
      if (scheduleError) throw scheduleError;
      
      return res.json({
        success: true,
        message: `Notification scheduled for ${targetUsers.length} users`,
        scheduledCount: targetUsers.length
      });
    }
    
    // Send notifications immediately
    const results = await Promise.all(
      targetUsers.map(async (user) => {
        try {
          const result = await sendPushNotification(
            user.push_token,
            title,
            body,
            data
          );
          
          // Save to database
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              title,
              body,
              data,
              status: result.success ? 'sent' : 'failed',
              sent_at: new Date().toISOString(),
              error: result.error || null,
              is_broadcast: segment !== 'specific'
            });
          
          return {
            userId: user.id,
            email: user.email,
            success: result.success,
            error: result.error
          };
        } catch (error) {
          return {
            userId: user.id,
            email: user.email,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      },
      results: segment === 'specific' ? results : undefined
    });
  } catch (error) {
    console.error('[Admin Notifications] Error sending notification:', error);
    res.status(500).json({
      error: { message: 'Failed to send notification' }
    });
  }
});

// Send bulk notifications
router.post('/send-bulk', requireAdminAuth, async (req, res) => {
  try {
    const { userIds, title, body, data = {} } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: { message: 'User IDs array is required' }
      });
    }
    
    if (!title || !body) {
      return res.status(400).json({
        error: { message: 'Title and body are required' }
      });
    }
    
    const supabase = getSupabase();
    
    // Get users with push tokens
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, push_token')
      .in('id', userIds)
      .not('push_token', 'is', null);
    
    if (userError || !users || users.length === 0) {
      return res.status(404).json({
        error: { message: 'No users found with push tokens' }
      });
    }
    
    // Send notifications in parallel
    const results = await Promise.all(
      users.map(async (user) => {
        try {
          const result = await sendPushNotification(
            user.push_token,
            title,
            body,
            data
          );
          
          // Save to database
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              title,
              body,
              data,
              status: result.success ? 'sent' : 'failed',
              sent_at: new Date().toISOString(),
              error: result.error || null
            });
          
          return {
            userId: user.id,
            email: user.email,
            success: result.success,
            error: result.error
          };
        } catch (error) {
          return {
            userId: user.id,
            email: user.email,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      },
      results
    });
  } catch (error) {
    console.error('[Admin Notifications] Error sending bulk notifications:', error);
    res.status(500).json({
      error: { message: 'Failed to send bulk notifications' }
    });
  }
});

// Send notification to all users
router.post('/broadcast', requireAdminAuth, async (req, res) => {
  try {
    const { title, body, data = {}, filter = {} } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({
        error: { message: 'Title and body are required' }
      });
    }
    
    const supabase = getSupabase();
    
    // Build query based on filters
    let query = supabase
      .from('profiles')
      .select('id, email, push_token')
      .not('push_token', 'is', null);
    
    // Apply filters
    // Note: profiles table doesn't have a role column
    
    if (filter.isActive !== undefined) {
      query = query.eq('is_active', filter.isActive);
    }
    
    if (filter.lastSeenDays) {
      const date = new Date();
      date.setDate(date.getDate() - filter.lastSeenDays);
      query = query.gte('last_seen', date.toISOString());
    }
    
    const { data: users, error: userError } = await query;
    
    if (userError || !users || users.length === 0) {
      return res.status(404).json({
        error: { message: 'No users found matching criteria' }
      });
    }
    
    // Start sending in background
    res.json({
      success: true,
      message: `Broadcasting to ${users.length} users`,
      totalUsers: users.length
    });
    
    // Send notifications asynchronously
    users.forEach(async (user) => {
      try {
        const result = await sendPushNotification(
          user.push_token,
          title,
          body,
          data
        );
        
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            title,
            body,
            data,
            status: result.success ? 'sent' : 'failed',
            sent_at: new Date().toISOString(),
            error: result.error || null,
            is_broadcast: true
          });
      } catch (error) {
        console.error(`[Admin Notifications] Failed to send to ${user.email}:`, error);
      }
    });
  } catch (error) {
    console.error('[Admin Notifications] Error broadcasting:', error);
    res.status(500).json({
      error: { message: 'Failed to broadcast notification' }
    });
  }
});

// Get notification statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get total users and users with push tokens
    const [
      { count: totalUsers },
      { count: usersWithTokens },
      { data: recentNotifications }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('push_token', 'is', null),
      supabase.from('notifications')
        .select('status, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ]);
    
    // Calculate notification counts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    
    let sentToday = 0;
    let sentWeek = 0;
    let pending = 0;
    
    if (recentNotifications) {
      recentNotifications.forEach(notif => {
        if (notif.status === 'sent') {
          sentWeek++;
          const notifDate = new Date(notif.created_at);
          if (notifDate >= today) {
            sentToday++;
          }
        } else if (notif.status === 'pending') {
          pending++;
        }
      });
    }
    
    res.json({
      total_users: totalUsers || 0,
      users_with_tokens: usersWithTokens || 0,
      notifications_sent_today: sentToday,
      notifications_sent_week: sentWeek,
      pending_notifications: pending
    });
  } catch (error) {
    console.error('[Admin Notifications] Error fetching stats:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch notification statistics' }
    });
  }
});

// Delete notification
router.delete('/:notificationId', requireAdminAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('[Admin Notifications] Error deleting notification:', error);
    res.status(500).json({
      error: { message: 'Failed to delete notification' }
    });
  }
});

// Get notification templates
router.get('/templates', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data: templates, error } = await supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return res.json({ templates: [] });
      }
      throw error;
    }
    
    res.json({ templates: templates || [] });
  } catch (error) {
    console.error('[Admin Notifications] Error fetching templates:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch notification templates' }
    });
  }
});

// Get scheduled notifications
router.get('/scheduled', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data: scheduled, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .order('scheduled_for', { ascending: true });
    
    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return res.json({ notifications: [] });
      }
      throw error;
    }
    
    res.json({ notifications: scheduled || [] });
  } catch (error) {
    console.error('[Admin Notifications] Error fetching scheduled notifications:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch scheduled notifications' }
    });
  }
});

// Create notification template
router.post('/templates', requireAdminAuth, async (req, res) => {
  try {
    const { name, title, body, data = {} } = req.body;
    
    if (!name || !title || !body) {
      return res.status(400).json({
        error: { message: 'Name, title, and body are required' }
      });
    }
    
    const supabase = getSupabase();
    
    const { data: template, error } = await supabase
      .from('notification_templates')
      .insert({
        name,
        title,
        body,
        data
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('[Admin Notifications] Error creating template:', error);
    res.status(500).json({
      error: { message: 'Failed to create notification template' }
    });
  }
});

// Update notification template
router.put('/templates/:templateId', requireAdminAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, title, body, data = {} } = req.body;
    
    if (!name || !title || !body) {
      return res.status(400).json({
        error: { message: 'Name, title, and body are required' }
      });
    }
    
    const supabase = getSupabase();
    
    const { data: template, error } = await supabase
      .from('notification_templates')
      .update({
        name,
        title,
        body,
        data,
        updated_at: new Date().toISOString()
      })
      .eq('id', templateId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('[Admin Notifications] Error updating template:', error);
    res.status(500).json({
      error: { message: 'Failed to update notification template' }
    });
  }
});

// Delete notification template
router.delete('/templates/:templateId', requireAdminAuth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', templateId);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('[Admin Notifications] Error deleting template:', error);
    res.status(500).json({
      error: { message: 'Failed to delete notification template' }
    });
  }
});

// Cancel scheduled notification
router.post('/scheduled/:notificationId/cancel', requireAdminAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({
      success: true,
      notification: data
    });
  } catch (error) {
    console.error('[Admin Notifications] Error cancelling notification:', error);
    res.status(500).json({
      error: { message: 'Failed to cancel scheduled notification' }
    });
  }
});

export default router;