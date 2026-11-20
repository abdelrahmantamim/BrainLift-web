import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Menu, MessageSquare, Sun, Moon, Monitor } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';
import { FeedbackForm } from '../FeedbackForm';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, showMenuButton = false }) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const user = useAuthStore((state) => state.user);
  const { theme, resolvedTheme, toggleTheme } = useUIStore();

  const themeIcon =
    theme === 'system' ? (
      <Monitor className="w-5 h-5" />
    ) : resolvedTheme === 'dark' ? (
      <Moon className="w-5 h-5" />
    ) : (
      <Sun className="w-5 h-5" />
    );

  const themeTitle =
    theme === 'light'
      ? 'Theme: Light (click for Dark)'
      : theme === 'dark'
      ? 'Theme: Dark (click for System)'
      : 'Theme: System (click for Light)';

  return (
    <>
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-pg-surface border-b-3 border-pg-navy z-40 transition-all duration-300">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          {showMenuButton && (
            <button
              onClick={onMenuClick}
              className="p-2 rounded-lg hover:bg-pg-cream transition-colors lg:hidden text-pg-navy"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle (light -> dark -> system) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
            title={themeTitle}
          >
            {themeIcon}
          </button>

          {/* Feedback Button */}
          <button
            onClick={() => setShowFeedback(true)}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
            title="Send Feedback"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <NotificationBell />

          {/* Profile */}
          <Link
            to="/profile"
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-pg-cream transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-pg-coral border-2 border-pg-navy flex items-center justify-center overflow-hidden">
              {(user?.avatar_url || user?.avatarUrl) ? (
                <img
                  src={user.avatar_url || user.avatarUrl}
                  alt={user.name || user.username || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-white" />
              )}
            </div>
            <span className="hidden sm:block text-sm font-body font-semibold text-pg-navy">
              {user?.name || user?.username || 'Profile'}
            </span>
          </Link>
        </div>
      </div>
    </header>

    {/* Feedback Form Modal */}
    <FeedbackForm
      isOpen={showFeedback}
      onClose={() => setShowFeedback(false)}
    />
    </>
  );
};
