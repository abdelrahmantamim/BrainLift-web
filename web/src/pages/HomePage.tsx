import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, FolderOpen, BookOpen, BrainCircuit, TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { DashboardSkeleton, StatsCardSkeleton } from '@/components/common/LoadingSkeletons';
import DailyGoals from '@/components/dashboard/DailyGoals';
import RecentActivities from '@/components/dashboard/RecentActivities';
import DashboardErrorBoundary from '@/components/dashboard/ErrorBoundary';
import AnimatedCounter from '@/components/dashboard/AnimatedCounter';
import { safeFormatDistanceToNow } from '@/utils/dateUtils';

export const HomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const {
    dashboardData,
    dailyGoals,
    recentActivities,
    isLoading,
    isLoadingGoals,
    isLoadingActivities,
    isRefreshing,
    error,
    activitiesError,
    fetchDashboardData,
    fetchDailyGoals,
    fetchRecentActivities,
    refreshAll,
    startAutoRefresh,
    stopAutoRefresh,
    clearError,
    lastRefresh
  } = useDashboardStore();

  // Initialize data and auto-refresh on component mount
  useEffect(() => {
    const initializeDashboard = async () => {
      clearError();
      await Promise.all([
        fetchDashboardData(),
        fetchDailyGoals(),
        fetchRecentActivities({ limit: 10 })
      ]);
    };

    initializeDashboard();
    startAutoRefresh();

    return () => {
      stopAutoRefresh();
    };
  }, [fetchDashboardData, fetchDailyGoals, fetchRecentActivities, startAutoRefresh, stopAutoRefresh, clearError]);

  // Format stats from real data
  const stats = dashboardData ? [
    {
      label: 'Study Streak',
      value: `${dashboardData.currentStats.currentStreak} ${dashboardData.currentStats.currentStreak === 1 ? 'day' : 'days'}`,
      icon: TrendingUp,
      color: 'coral',
      bgColor: 'bg-pg-coral'
    },
    {
      label: 'Total Sessions',
      value: dashboardData.currentStats.totalSessions.toString(),
      icon: MessageSquare,
      color: 'teal',
      bgColor: 'bg-pg-teal'
    },
    {
      label: 'Quizzes Completed',
      value: dashboardData.currentStats.totalQuizzes.toString(),
      icon: BrainCircuit,
      color: 'yellow',
      bgColor: 'bg-pg-yellow'
    },
    {
      label: 'Study Time',
      value: `${Math.round(dashboardData.currentStats.totalStudyMinutes / 60)}h`,
      icon: Clock,
      color: 'lilac',
      bgColor: 'bg-pg-lilac'
    },
  ] : [];

  const quickActions = [
    { path: '/chat', label: 'New Chat', icon: MessageSquare, description: 'Start a new AI tutoring session', color: 'coral' },
    { path: '/files', label: 'Upload Files', icon: FolderOpen, description: 'Upload study materials', color: 'teal' },
    { path: '/flashcards', label: 'Create Flashcards', icon: BookOpen, description: 'Generate flashcards from your notes', color: 'yellow' },
    { path: '/quizzes', label: 'Take Quiz', icon: BrainCircuit, description: 'Test your knowledge', color: 'lilac' },
  ];

  // Loading state for initial load
  if (isLoading && !dashboardData) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="pg-card shadow-clay-coral p-8 text-center">
          <div className="text-pg-coral mb-4">
            <BrainCircuit className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-pg-coral mb-2">Failed to Load Dashboard</h2>
          <p className="text-pg-text-secondary font-body mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-pg-coral text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div className="pg-card shadow-clay-coral p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-pg-navy mb-2">
              Welcome back, {dashboardData?.user.name || user?.name || user?.username || 'Student'}!
            </h1>
            <p className="text-pg-text-secondary font-body">Ready to continue your learning journey?</p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-pg-text-secondary font-body">
                Updated {safeFormatDistanceToNow(lastRefresh, { addSuffix: true })}
              </span>
            )}
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className={`p-2 text-pg-navy hover:bg-pg-cream rounded-lg transition-colors ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refresh dashboard data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading && !dashboardData ? (
          Array.from({ length: 4 }).map((_, index) => (
            <StatsCardSkeleton key={index} />
          ))
        ) : (
          stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`pg-card shadow-clay-${stat.color} p-6 transform transition-all duration-200 hover:-translate-y-1 hover:shadow-clay-${stat.color}-hover ${isRefreshing ? 'animate-pulse' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center border-2 border-pg-navy`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <AnimatedCounter
                    value={stat.value}
                    className="text-2xl font-heading font-bold text-pg-navy"
                  />
                </div>
                <p className="text-sm text-pg-text-secondary font-body font-semibold">{stat.label}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-2xl font-heading font-bold text-pg-navy">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className={`pg-card shadow-clay-${action.color} hover:shadow-clay-${action.color}-hover hover:-translate-y-1 transition-all duration-200 p-6 group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-pg-${action.color} flex items-center justify-center border-2 border-pg-navy group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-lg mb-1 text-pg-navy">{action.label}</h3>
                    <p className="text-sm text-pg-text-secondary font-body">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Daily Goals */}
      {dailyGoals && (
        <DailyGoals
          goals={dailyGoals}
          isLoading={isLoadingGoals}
        />
      )}

      {/* Recent Activity */}
      <RecentActivities
        activities={recentActivities}
        isLoading={isLoadingActivities}
        error={activitiesError}
      />
      </div>
    </DashboardErrorBoundary>
  );
};
