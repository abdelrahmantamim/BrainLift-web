import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';
import { EventEmitter } from 'events';

class ViralEventMonitor extends EventEmitter {
  constructor() {
    super();
    this.supabase = null;
    this.metrics = {
      sharesPerMinute: 0,
      newUsersPerMinute: 0,
      apiRequestsPerSecond: 0,
      importsPerMinute: 0,
      notificationsPerMinute: 0
    };
    this.thresholds = {
      sharesPerMinute: 100,
      newUsersPerMinute: 50,
      apiRequestsPerSecond: 1000,
      importsPerMinute: 200,
      notificationsPerMinute: 500
    };
    this.isViralMode = false;
    this.monitoringInterval = null;
    this.metricsCache = new Map();
    this.lastAlertTime = 0;
    this.alertCooldown = 5 * 60 * 1000; // 5 minutes between alerts
  }

  getSupabaseClient() {
    if (!this.supabase) {
      try {
        this.supabase = getSupabase();
      } catch (error) {
        logger.error('ViralEventMonitor', 'Failed to initialize Supabase:', error);
      }
    }
    return this.supabase;
  }

  /**
   * Start monitoring for viral events
   */
  startMonitoring() {
    if (this.monitoringInterval) return;
    
    // Check metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.checkForViralEvent();
    }, 30000);
    
    // Initial check
    this.checkForViralEvent();
    logger.info('ViralEventMonitor', 'Started monitoring for viral events');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.info('ViralEventMonitor', 'Stopped monitoring for viral events');
  }

  /**
   * Get current metrics
   */
  async getMetrics() {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return this.metrics;

      const now = new Date();
      const oneMinuteAgo = new Date(now - 60 * 1000);
      const oneSecondAgo = new Date(now - 1000);

      // Get shares per minute
      const { count: shareCount } = await supabase
        .from('shareable_links')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMinuteAgo.toISOString());
      
      this.metrics.sharesPerMinute = shareCount || 0;

      // Get new users per minute
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMinuteAgo.toISOString());
      
      this.metrics.newUsersPerMinute = userCount || 0;

      // Get imports per minute
      const { count: importCount } = await supabase
        .from('share_access_logs')
        .select('*', { count: 'exact', head: true })
        .eq('action', 'imported')
        .gte('created_at', oneMinuteAgo.toISOString());
      
      this.metrics.importsPerMinute = importCount || 0;

      // Get notifications per minute
      const { count: notificationCount } = await supabase
        .from('push_notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMinuteAgo.toISOString());
      
      this.metrics.notificationsPerMinute = notificationCount || 0;

      // API requests per second (approximated from rate limit hits)
      // This would typically come from a Redis counter or API gateway metrics
      this.metrics.apiRequestsPerSecond = await this.getAPIRequestRate();

      return this.metrics;
    } catch (error) {
      logger.error('ViralEventMonitor', 'Error getting metrics:', error);
      return this.metrics;
    }
  }

  /**
   * Get API request rate (mock implementation - would use Redis in production)
   */
  async getAPIRequestRate() {
    // In production, this would query Redis or an API gateway
    // For now, we'll estimate based on database activity
    const supabase = this.getSupabaseClient();
    if (!supabase) return 0;

    try {
      const oneSecondAgo = new Date(Date.now() - 1000);
      const { count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneSecondAgo.toISOString());
      
      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if we're experiencing a viral event
   */
  async checkForViralEvent() {
    try {
      const metrics = await this.getMetrics();
      const viralConditions = [];

      // Check each metric against thresholds
      for (const [metric, value] of Object.entries(metrics)) {
        if (value > this.thresholds[metric]) {
          viralConditions.push({
            metric,
            value,
            threshold: this.thresholds[metric],
            exceedance: ((value / this.thresholds[metric]) * 100).toFixed(1)
          });
        }
      }

      // Viral event detected
      if (viralConditions.length >= 2 && !this.isViralMode) {
        logger.warn('ViralEventMonitor', 'VIRAL EVENT DETECTED!', {
          conditions: viralConditions,
          metrics
        });
        
        await this.triggerViralProtocol(viralConditions, metrics);
      } 
      // Viral event ended
      else if (viralConditions.length === 0 && this.isViralMode) {
        logger.info('ViralEventMonitor', 'Viral event ended', { metrics });
        await this.disableViralProtocol();
      }

      // Log current status
      if (viralConditions.length > 0) {
        logger.info('ViralEventMonitor', 'Elevated activity detected:', {
          conditions: viralConditions,
          isViralMode: this.isViralMode
        });
      }

    } catch (error) {
      logger.error('ViralEventMonitor', 'Error checking for viral event:', error);
    }
  }

  /**
   * Trigger viral protection protocol
   */
  async triggerViralProtocol(conditions, metrics) {
    this.isViralMode = true;
    
    // Emit event for other services to react
    this.emit('viral-event-started', { conditions, metrics });

    // Record viral event in database
    const supabase = this.getSupabaseClient();
    if (supabase) {
      await supabase.from('viral_events').insert({
        event_type: 'viral_surge_detected',
        metrics: metrics,
        conditions: conditions,
        started_at: new Date().toISOString()
      });
    }

    // Alert team if not in cooldown
    if (Date.now() - this.lastAlertTime > this.alertCooldown) {
      await this.alertTeam('Viral event detected!', conditions, metrics);
      this.lastAlertTime = Date.now();
    }

    // Log recommended actions
    logger.warn('ViralEventMonitor', 'VIRAL PROTOCOL ACTIVATED - Recommended actions:', [
      '1. Enable stricter rate limits',
      '2. Scale up infrastructure',
      '3. Enable additional caching',
      '4. Monitor for abuse patterns',
      '5. Check content moderation queue'
    ]);
  }

  /**
   * Disable viral protection protocol
   */
  async disableViralProtocol() {
    this.isViralMode = false;
    
    // Emit event
    this.emit('viral-event-ended', { metrics: this.metrics });

    // Update database
    const supabase = this.getSupabaseClient();
    if (supabase) {
      // Find and update the most recent viral event
      const { data: events } = await supabase
        .from('viral_events')
        .select('id')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (events && events.length > 0) {
        await supabase
          .from('viral_events')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', events[0].id);
      }
    }

    logger.info('ViralEventMonitor', 'VIRAL PROTOCOL DEACTIVATED - Returning to normal operations');
  }

  /**
   * Alert the team about viral events
   */
  async alertTeam(message, conditions, metrics) {
    // In production, this would send to Slack, PagerDuty, etc.
    logger.error('ViralEventMonitor', '🚨 TEAM ALERT 🚨', {
      message,
      conditions,
      metrics,
      timestamp: new Date().toISOString()
    });

    // Could also send push notifications to admin users
    try {
      const supabase = this.getSupabaseClient();
      if (supabase) {
        // Get admin users
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, email')
          .like('email', '%@getbrainlift.app');
        
        if (admins && admins.length > 0) {
          // Create notifications for admins
          const notifications = admins.map(admin => ({
            user_id: admin.id,
            title: '🚨 Viral Event Detected',
            body: `${message} - Check monitoring dashboard immediately`,
            data: { 
              type: 'viral_alert',
              conditions: JSON.stringify(conditions),
              metrics: JSON.stringify(metrics)
            },
            created_at: new Date().toISOString()
          }));
          
          await supabase.from('push_notifications').insert(notifications);
        }
      }
    } catch (error) {
      logger.error('ViralEventMonitor', 'Failed to send admin notifications:', error);
    }
  }

  /**
   * Get viral event history
   */
  async getViralEventHistory(days = 30) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data: events, error } = await supabase
        .from('viral_events')
        .select('*')
        .gte('started_at', cutoffDate.toISOString())
        .order('started_at', { ascending: false });

      if (error) {
        logger.error('ViralEventMonitor', 'Failed to get viral event history:', error);
        return [];
      }

      return events || [];
    } catch (error) {
      logger.error('ViralEventMonitor', 'Error getting viral event history:', error);
      return [];
    }
  }

  /**
   * Update thresholds dynamically
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('ViralEventMonitor', 'Updated viral event thresholds:', this.thresholds);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isMonitoring: !!this.monitoringInterval,
      isViralMode: this.isViralMode,
      currentMetrics: this.metrics,
      thresholds: this.thresholds,
      lastAlertTime: this.lastAlertTime
    };
  }
}

// Create singleton instance
const viralEventMonitor = new ViralEventMonitor();

// NOTE: Auto-start disabled to save Supabase egress (~14,400 queries/day).
// Re-enable when the app has real traffic and viral detection is needed.
// To start manually: viralEventMonitor.startMonitoring()
// setTimeout(() => {
//   viralEventMonitor.startMonitoring();
// }, 10000);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  viralEventMonitor.stopMonitoring();
});

process.on('SIGINT', () => {
  viralEventMonitor.stopMonitoring();
});

export default viralEventMonitor;