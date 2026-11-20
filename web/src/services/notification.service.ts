import axios from '@/services/api';
import toast from 'react-hot-toast';

interface NotificationOptions {
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: unknown;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

  constructor() {
    if (this.isSupported) {
      this.registerServiceWorker();
    }
  }

  private async registerServiceWorker() {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', this.swRegistration);
    } catch (error) {
      console.error('Failed to register service worker:', error);
    }
  }

  async init() {
    if (!this.isSupported) return;

    try {
      if (!this.swRegistration) {
        await this.registerServiceWorker();
      }

      if (Notification.permission === 'granted') {
        await this.subscribeToNotifications();
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      toast.error('Push notifications are not supported in your browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        await this.subscribeToNotifications();
        toast.success('Notifications enabled successfully');
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied. You can enable it in browser settings.');
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable notifications');
      return false;
    }
  }

  private async subscribeToNotifications() {
    if (!this.swRegistration) {
      await this.init();
    }

    if (!this.swRegistration) {
      throw new Error('Service Worker not registered');
    }

    try {
      // Get VAPID public key from server
      const { data } = await axios.get('/notifications/vapid-key');
      const vapidPublicKey = data.publicKey;

      // Convert VAPID key to Uint8Array
      const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);

      // Subscribe to push notifications
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      console.log('Push notification subscription successful');
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription) {
    try {
      await axios.post('/notifications/subscribe', {
        subscription: subscription.toJSON(),
        device: {
          type: 'web',
          browser: this.getBrowserInfo(),
          os: this.getOSInfo(),
        },
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  async unsubscribe() {
    if (!this.swRegistration) return;

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server
        await axios.post('/notifications/unsubscribe', {
          endpoint: subscription.endpoint,
        });
        
        toast.success('Notifications disabled');
      }
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
      toast.error('Failed to disable notifications');
    }
  }

  async checkPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) return 'denied';
    return Notification.permission;
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.swRegistration) return false;
    
    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }

  // Show local notification (for testing or immediate notifications)
  async showNotification(title: string, options?: NotificationOptions) {
    if (!this.isSupported || Notification.permission !== 'granted') {
      console.warn('Cannot show notification - permission not granted');
      return;
    }

    if (this.swRegistration) {
      // Use service worker to show notification
      await this.swRegistration.showNotification(title, {
        icon: options?.icon || '/icon-192x192.png',
        badge: options?.badge || '/icon-96x96.png',
        ...options,
      });
    } else {
      // Fallback to Notification API
      new Notification(title, options);
    }
  }

  // Get notification history from server
  async getNotificationHistory(page = 1, limit = 20) {
    try {
      const { data } = await axios.get('/notifications/history', {
        params: { page, limit },
      });
      return data;
    } catch (error) {
      console.error('Failed to fetch notification history:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    try {
      await axios.post(`/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      await axios.post('/notifications/read-all');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Update notification preferences
  async updatePreferences(preferences: {
    quiz_completed?: boolean;
    content_shared?: boolean;
    study_reminder?: boolean;
    achievement_unlocked?: boolean;
  }) {
    try {
      const { data } = await axios.put('/notifications/preferences', preferences);
      return data;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  }

  // Utility methods
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private getOSInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iOS')) return 'iOS';
    return 'Unknown';
  }
}

export const notificationService = new NotificationService();