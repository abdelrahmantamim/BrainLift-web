import { create } from 'zustand';
import { statsService } from '@/services/stats.service';
import type { DashboardData, RecentActivity, DailyGoals } from '@/services/stats.service';
import toast from 'react-hot-toast';

interface DashboardState {
  // Data
  dashboardData: DashboardData | null;
  recentActivities: RecentActivity[];
  dailyGoals: DailyGoals | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingActivities: boolean;
  isLoadingGoals: boolean;
  isRefreshing: boolean;
  
  // Error states
  error: string | null;
  activitiesError: string | null;
  goalsError: string | null;
  
  // Auto-refresh
  refreshInterval: NodeJS.Timeout | null;
  lastRefresh: Date | null;
  
  // Actions
  fetchDashboardData: () => Promise<void>;
  fetchRecentActivities: (params?: { limit?: number; offset?: number; type?: string }) => Promise<void>;
  fetchDailyGoals: (date?: string) => Promise<void>;
  updateDailyGoals: (goals: { quizzes?: number; flashcards?: number; chatSessions?: number; files?: number; studyMinutes?: number }) => Promise<void>;
  refreshAll: () => Promise<void>;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Initial state
  dashboardData: null,
  recentActivities: [],
  dailyGoals: null,
  isLoading: false,
  isLoadingActivities: false,
  isLoadingGoals: false,
  isRefreshing: false,
  error: null,
  activitiesError: null,
  goalsError: null,
  refreshInterval: null,
  lastRefresh: null,

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await statsService.getDashboardData();
      set({ 
        dashboardData: data,
        isLoading: false,
        lastRefresh: new Date(),
        error: null
      });
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      const message = errorData.message || 'Failed to fetch dashboard data';
      set({ 
        error: message,
        isLoading: false
      });
      console.error('Error fetching dashboard data:', error);
    }
  },

  fetchRecentActivities: async (params = {}) => {
    set({ isLoadingActivities: true, activitiesError: null });
    try {
      const response = await statsService.getRecentActivities(params);
      set({ 
        recentActivities: response.activities,
        isLoadingActivities: false,
        activitiesError: null
      });
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      const message = errorData.message || 'Failed to fetch recent activities';
      set({ 
        activitiesError: message,
        isLoadingActivities: false
      });
      console.error('Error fetching recent activities:', error);
    }
  },

  fetchDailyGoals: async (date?: string) => {
    set({ isLoadingGoals: true, goalsError: null });
    try {
      const goals = await statsService.getDailyGoals(date);
      set({ 
        dailyGoals: goals,
        isLoadingGoals: false,
        goalsError: null
      });
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      const message = errorData.message || 'Failed to fetch daily goals';
      set({ 
        goalsError: message,
        isLoadingGoals: false
      });
      console.error('Error fetching daily goals:', error);
    }
  },

  updateDailyGoals: async (goals) => {
    try {
      await statsService.updateDailyGoals(goals);
      // Refresh daily goals after update
      await get().fetchDailyGoals();
      toast.success('Daily goals updated successfully!');
    } catch (error: unknown) {
      const errorData = error as { message?: string };
      const message = errorData.message || 'Failed to update daily goals';
      toast.error(message);
      console.error('Error updating daily goals:', error);
    }
  },

  refreshAll: async () => {
    set({ isRefreshing: true });
    try {
      await Promise.all([
        get().fetchDashboardData(),
        get().fetchRecentActivities({ limit: 10 }),
        get().fetchDailyGoals()
      ]);
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      set({ isRefreshing: false });
    }
  },

  startAutoRefresh: () => {
    // Clear existing interval
    const currentInterval = get().refreshInterval;
    if (currentInterval) {
      clearInterval(currentInterval);
    }

    // Set up new interval (30 seconds)
    const interval = setInterval(() => {
      get().refreshAll();
    }, 30000);

    set({ refreshInterval: interval });
  },

  stopAutoRefresh: () => {
    const interval = get().refreshInterval;
    if (interval) {
      clearInterval(interval);
      set({ refreshInterval: null });
    }
  },

  clearError: () => {
    set({ error: null, activitiesError: null, goalsError: null });
  }
}));