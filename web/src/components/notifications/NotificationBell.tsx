import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Settings, Clock, Share2, Trophy, BookOpen } from 'lucide-react';
import { notificationService } from '@/services/notification.service';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'quiz_completed' | 'content_shared' | 'study_reminder' | 'achievement_unlocked';
  title: string;
  body: string;
  data?: unknown;
  read: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkPermission();
    loadNotifications();

    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkPermission = async () => {
    const perm = await notificationService.checkPermission();
    setPermission(perm);
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getNotificationHistory(1, 10);
      if (data.notifications) {
        setNotifications(data.notifications);
      }
      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    if (granted) {
      setPermission('granted');
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'quiz_completed':
        return <Check className="w-4 h-4" />;
      case 'content_shared':
        return <Share2 className="w-4 h-4" />;
      case 'study_reminder':
        return <Clock className="w-4 h-4" />;
      case 'achievement_unlocked':
        return <Trophy className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'quiz_completed':
        return 'text-pg-teal';
      case 'content_shared':
        return 'text-pg-coral';
      case 'study_reminder':
        return 'text-pg-yellow';
      case 'achievement_unlocked':
        return 'text-pg-lilac';
      default:
        return 'text-pg-text-secondary';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-pg-navy/10 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6 text-pg-navy" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-pg-coral text-white text-xs rounded-full flex items-center justify-center font-heading font-bold border-2 border-pg-navy">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 border-2 border-pg-navy rounded-xl bg-pg-surface shadow-clay-teal overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b-2 border-pg-navy/20 bg-pg-cream/20">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-pg-navy">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-sm text-pg-coral hover:text-pg-coral/80 font-body font-semibold"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => {/* TODO: Open settings */}}
                  className="p-1 hover:bg-pg-navy/10 rounded"
                >
                  <Settings className="w-4 h-4 text-pg-navy" />
                </button>
              </div>
            </div>
          </div>

          {/* Permission Request */}
          {permission !== 'granted' && (
            <div className="px-4 py-3 bg-pg-teal/10 border-b-2 border-pg-navy/20">
              <p className="text-sm mb-2 font-body text-pg-navy">Enable notifications to stay updated</p>
              <button
                onClick={handleEnableNotifications}
                className="px-3 py-1 bg-pg-teal text-white text-sm rounded hover:bg-pg-teal/80 transition-colors font-heading font-semibold border-2 border-pg-navy"
              >
                Enable Notifications
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-pg-text-secondary font-body">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-pg-text-secondary" />
                <p className="text-pg-text-secondary font-body">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-pg-navy/5 transition-colors cursor-pointer border-b border-pg-navy/10 ${
                    !notification.read ? 'bg-pg-navy/5' : ''
                  }`}
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-pg-navy/10 ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-semibold text-sm text-pg-navy">{notification.title}</p>
                      <p className="text-sm text-pg-text-secondary mt-1 font-body">{notification.body}</p>
                      <p className="text-xs text-pg-text-secondary mt-1 font-body">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-pg-coral rounded-full mt-2 flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t-2 border-pg-navy/20 text-center bg-pg-cream/20">
              <button className="text-sm text-pg-coral hover:text-pg-coral/80 font-body font-semibold">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
