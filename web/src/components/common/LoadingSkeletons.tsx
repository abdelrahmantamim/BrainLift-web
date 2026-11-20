import React from 'react';
import { BrainLifting } from './BrainLifting';

interface SkeletonProps {
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-pg-navy/10 rounded ${className}`} />
);

export const StatsCardSkeleton: React.FC = () => (
  <div className="pg-card shadow-clay-teal space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="w-12 h-12 rounded-lg" />
      <Skeleton className="w-12 h-8" />
    </div>
    <Skeleton className="w-24 h-4" />
  </div>
);

export const ActivityItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3">
    <Skeleton className="w-5 h-5 rounded" />
    <div className="flex-1 space-y-2">
      <Skeleton className="w-3/4 h-4" />
      <Skeleton className="w-1/2 h-3" />
    </div>
  </div>
);

export const DailyGoalSkeleton: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="w-20 h-4" />
      <Skeleton className="w-10 h-4" />
    </div>
    <Skeleton className="w-full h-2 rounded-full" />
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto space-y-8">
    {/* Welcome Section Skeleton */}
    <div className="pg-card shadow-clay-teal">
      <Skeleton className="w-80 h-8 mb-2" />
      <Skeleton className="w-60 h-5" />
    </div>

    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <StatsCardSkeleton key={index} />
      ))}
    </div>

    {/* Daily Goals Skeleton */}
    <div className="pg-card shadow-clay-teal">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-32 h-7" />
        <Skeleton className="w-16 h-6" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <DailyGoalSkeleton key={index} />
        ))}
      </div>
    </div>

    {/* Recent Activity Skeleton */}
    <div className="pg-card shadow-clay-teal">
      <Skeleton className="w-40 h-7 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <ActivityItemSkeleton key={index} />
        ))}
      </div>
    </div>
  </div>
);

export const FullPageLoading: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <BrainLifting message={message} />
  </div>
);

export default Skeleton;
