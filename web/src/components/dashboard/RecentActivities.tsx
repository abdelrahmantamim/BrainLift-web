import React from 'react';
import { MessageSquare, BookOpen, FolderOpen, CheckCircle, Trophy, Award } from 'lucide-react';
import type { RecentActivity } from '@/services/stats.service';
import { safeFormatDistanceToNow } from '@/utils/dateUtils';
import { ActivityItemSkeleton } from '@/components/common/LoadingSkeletons';

interface RecentActivitiesProps {
  activities: RecentActivity[];
  isLoading?: boolean;
  error?: string | null;
}

const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    chatbubbles: MessageSquare,
    trophy: Trophy,
    cards: BookOpen,
    'cloud-upload': FolderOpen,
    book: BookOpen,
    'checkmark-circle': CheckCircle,
    award: Award,
  };

  return iconMap[iconName] || CheckCircle;
};

const getIconColor = (activityType: string) => {
  const colorMap: Record<string, string> = {
    quiz_completed: 'text-pg-teal',
    flashcard_session: 'text-pg-coral',
    chat_session: 'text-pg-lilac',
    file_uploaded: 'text-pg-yellow',
    file_studied: 'text-pg-yellow',
    achievement_unlocked: 'text-pg-coral',
  };

  return colorMap[activityType] || 'text-pg-text-secondary';
};

const ActivityItem: React.FC<{ activity: RecentActivity }> = ({ activity }) => {
  const IconComponent = getIconComponent(activity.icon);
  const iconColor = getIconColor(activity.type);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-pg-navy/5 transition-colors group">
      <div className={`${iconColor} transition-transform group-hover:scale-110`}>
        <IconComponent className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold truncate text-pg-navy">{activity.title}</p>
        <p className="text-sm text-pg-text-secondary truncate font-body">{activity.description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {activity.pointsEarned > 0 && (
          <span className="text-xs font-heading font-semibold px-2.5 py-1 rounded-lg border-2 border-pg-navy bg-pg-yellow/20 text-pg-yellow whitespace-nowrap">
            +{activity.pointsEarned} pts
          </span>
        )}
        <span className="text-xs font-body px-2.5 py-1 rounded-lg border-2 border-pg-navy/30 bg-pg-cream text-pg-text-secondary whitespace-nowrap">
          {safeFormatDistanceToNow(activity.timestamp, { addSuffix: true })}
        </span>
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="text-center py-12">
    <CheckCircle className="w-12 h-12 text-pg-text-secondary mx-auto mb-3" />
    <h3 className="text-lg font-heading font-bold text-pg-navy mb-2">No recent activities</h3>
    <p className="text-sm text-pg-text-secondary font-body">Start learning to see your progress here!</p>
  </div>
);

const ErrorState: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="text-center py-8">
    <div className="text-pg-coral mb-3">
      <MessageSquare className="w-8 h-8 mx-auto" />
    </div>
    <h3 className="text-lg font-heading font-bold text-pg-navy mb-2">Failed to load activities</h3>
    <p className="text-sm text-pg-text-secondary mb-4 font-body">{error}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-pg-coral hover:bg-pg-coral/80 text-white rounded-lg transition-colors font-heading font-semibold border-2 border-pg-navy shadow-clay-coral"
    >
      Try Again
    </button>
  </div>
);

export const RecentActivities: React.FC<RecentActivitiesProps> = ({
  activities,
  isLoading = false,
  error = null
}) => {
  const handleRetry = () => {
    window.location.reload(); // Simple retry - in a real app you might want to call a retry function
  };

  return (
    <div className="pg-card shadow-clay-teal p-6">
      <h2 className="text-2xl font-heading font-bold mb-4 text-pg-navy">Recent Activity</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <ActivityItemSkeleton key={index} />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={handleRetry} />
      ) : activities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivities;
