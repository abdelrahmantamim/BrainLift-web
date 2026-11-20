import api from './api';

export interface XPProfile {
  totalXP: number;
  level: number;
  levelName: string;
  streak: number;
  progress: number;
  xpToNextLevel: number;
  nextLevelXP: number | null;
}

export interface XPAwardResult {
  success: boolean;
  xpAwarded: number;
  totalXP: number;
  level: number;
  levelName: string;
  levelChanged: boolean;
  alreadyAwarded?: boolean;
  message?: string;
}

export interface XPTransaction {
  id: string;
  amount: number;
  reason: string;
  sourceType: string;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalXP: number;
  level: number;
  levelName: string;
  isCurrentUser: boolean;
}

export interface Achievement {
  id?: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  points?: number;
  pointsAwarded?: number;
  unlockedAt?: string;
  type: string;
}

export interface AchievementsData {
  unlocked: Achievement[];
  available: Achievement[];
  totalUnlocked: number;
  totalAvailable: number;
}

class XPService {
  async getProfile(): Promise<XPProfile> {
    const response = await api.get<XPProfile>('/xp/profile');
    return response.data;
  }

  async awardXP(params: {
    amount: number;
    reason: string;
    sourceType: string;
    sourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<XPAwardResult> {
    const response = await api.post<XPAwardResult>('/xp/award', params);
    return response.data;
  }

  async claimDailyLogin(): Promise<XPAwardResult> {
    const response = await api.post<XPAwardResult>('/xp/daily-login');
    return response.data;
  }

  async getHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    transactions: XPTransaction[];
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

    const response = await api.get(`/xp/history?${searchParams.toString()}`);
    return response.data;
  }

  async getLeaderboard(limit?: number): Promise<{
    leaderboard: LeaderboardEntry[];
    userRank: number;
  }> {
    const searchParams = new URLSearchParams();
    if (limit) searchParams.append('limit', limit.toString());

    const response = await api.get(`/xp/leaderboard?${searchParams.toString()}`);
    return response.data;
  }

  async getAchievements(): Promise<AchievementsData> {
    const response = await api.get<AchievementsData>('/xp/achievements');
    return response.data;
  }
}

export const xpService = new XPService();
