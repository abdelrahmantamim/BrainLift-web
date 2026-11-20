// Dashboard components
export { default as DailyGoals } from './DailyGoals';
export { default as RecentActivities } from './RecentActivities';
export { default as DashboardErrorBoundary } from './ErrorBoundary';
export { default as AnimatedCounter } from './AnimatedCounter';

// Types
export type { DashboardStats, WeeklyStats, DailyGoals as DailyGoalsType, RecentActivity, Achievement, DashboardData } from '@/services/stats.service';