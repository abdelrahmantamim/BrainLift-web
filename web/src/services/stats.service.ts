import api from './api';

// Types
export interface DashboardStats {
  totalQuizzes: number;
  totalFlashcards: number;
  totalSessions: number;
  totalStudyMinutes: number;
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  averageQuizScore: number;
  questionsAnswered: number;
  correctAnswers: number;
}

export interface WeeklyStats {
  quizzesThisWeek: number;
  flashcardsThisWeek: number;
  sessionsThisWeek: number;
  studyMinutesThisWeek: number;
  averageScoreThisWeek: number;
}

export interface DailyGoals {
  goalDate: string;
  goals: {
    quizzes: number;
    flashcards: number;
    chatSessions: number;
    files: number;
    studyMinutes: number;
  };
  progress: {
    quizzes: number;
    flashcards: number;
    chatSessions: number;
    files: number;
    studyMinutes: number;
  };
  isCompleted: boolean;
  completionPercentage: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: string;
  pointsEarned: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Achievement {
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  pointsAwarded: number;
  unlockedAt: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
    student_type?: string;
    totalXP?: number;
    level?: number;
    levelName?: string;
  };
  currentStats: DashboardStats;
  weeklyStats: WeeklyStats;
  dailyGoal: DailyGoals;
  recentActivities: RecentActivity[];
  achievements: Achievement[];
}

export interface ActivityTrackingData {
  sessionType: 'quiz' | 'flashcard' | 'chat' | 'file_upload' | 'file_study';
  contentId?: string;
  contentTitle?: string;
  startTime?: string;
  endTime?: string;
  score?: number;
  questionsAnswered?: number;
  correctAnswers?: number;
  metadata?: Record<string, unknown>;
}

class StatsService {
  async getDashboardData(): Promise<DashboardData> {
    const response = await api.get<DashboardData>('/stats/dashboard');
    return response.data;
  }

  async getRecentActivities(params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<{
    activities: RecentActivity[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.type) searchParams.append('type', params.type);

    const response = await api.get(`/stats/activities?${searchParams.toString()}`);
    return response.data;
  }

  async getDailyGoals(date?: string): Promise<DailyGoals> {
    const searchParams = new URLSearchParams();
    if (date) searchParams.append('date', date);

    const response = await api.get<DailyGoals>(`/stats/daily-goals?${searchParams.toString()}`);
    return response.data;
  }

  async updateDailyGoals(goals: {
    quizzes?: number;
    flashcards?: number;
    chatSessions?: number;
    files?: number;
    studyMinutes?: number;
  }): Promise<{ success: boolean; goals: DailyGoals }> {
    const response = await api.put('/stats/daily-goals', { goals });
    return response.data;
  }

  async trackActivity(data: ActivityTrackingData): Promise<{
    success: boolean;
    session: {
      id: string;
      duration: number;
      pointsEarned: number;
    };
  }> {
    const response = await api.post('/stats/activities', data);
    return response.data;
  }

  async getAnalytics(params: {
    period?: 'week' | 'month' | 'year';
    type?: 'study_time' | 'quiz_count' | 'flashcard_count';
  } = {}): Promise<{
    period: string;
    type: string;
    data: Array<{
      date: string;
      value: number;
      label: string;
    }>;
    summary: {
      total: number;
      average: number;
      trend: string;
      trendPercentage: number;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params.period) searchParams.append('period', params.period);
    if (params.type) searchParams.append('type', params.type);

    const response = await api.get(`/stats/analytics?${searchParams.toString()}`);
    return response.data;
  }

  // Legacy stats endpoint (for backward compatibility)
  async getLegacyStats(): Promise<{
    sessions: number;
    hours: number;
    achievements: number;
    streak: number;
  }> {
    const response = await api.get('/stats/stats');
    return response.data;
  }
}

export const statsService = new StatsService();