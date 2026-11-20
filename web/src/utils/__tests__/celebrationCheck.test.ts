import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCelebrations } from '../celebrationCheck';
import { xpService } from '../../services/xp.service';

vi.mock('../../services/xp.service', () => ({
  xpService: {
    getProfile: vi.fn(),
    getAchievements: vi.fn(),
  },
}));

const mockedXpService = vi.mocked(xpService, true);

function makeCelebration() {
  return {
    showLevelUp: vi.fn(),
    showAchievement: vi.fn(),
    showConfetti: vi.fn(),
  };
}

describe('checkCelebrations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('on first run, stores state and celebrates nothing', async () => {
    mockedXpService.getProfile.mockResolvedValue({
      totalXP: 250, level: 2, levelName: 'Rising Star', streak: 1, progress: 0.5, xpToNextLevel: 250, nextLevelXP: 500,
    });
    mockedXpService.getAchievements.mockResolvedValue({
      unlocked: [{ key: 'first_quiz', name: 'First Quiz', description: 'd', icon: '🎯', pointsAwarded: 10, type: 'milestone' }],
      available: [],
      totalUnlocked: 1,
      totalAvailable: 1,
    });

    const celebration = makeCelebration();
    await checkCelebrations(celebration);

    expect(celebration.showLevelUp).not.toHaveBeenCalled();
    expect(celebration.showAchievement).not.toHaveBeenCalled();
    expect(localStorage.getItem('lastKnownLevel')).toBe('2');
    expect(JSON.parse(localStorage.getItem('lastKnownAchievements') ?? '[]')).toEqual(['first_quiz']);
  });

  it('fires showLevelUp when level increases from 2 to 3', async () => {
    localStorage.setItem('lastKnownLevel', '2');
    localStorage.setItem('lastKnownAchievements', JSON.stringify([]));
    mockedXpService.getProfile.mockResolvedValue({
      totalXP: 600, level: 3, levelName: 'Quick Learner', streak: 1, progress: 0.2, xpToNextLevel: 300, nextLevelXP: 900,
    });
    mockedXpService.getAchievements.mockResolvedValue({
      unlocked: [], available: [], totalUnlocked: 0, totalAvailable: 0,
    });

    const celebration = makeCelebration();
    await checkCelebrations(celebration);

    expect(celebration.showLevelUp).toHaveBeenCalledWith('Quick Learner', 3);
  });

  it('fires showAchievement for a newly unlocked achievement key', async () => {
    localStorage.setItem('lastKnownLevel', '3');
    localStorage.setItem('lastKnownAchievements', JSON.stringify(['first_quiz']));
    mockedXpService.getProfile.mockResolvedValue({
      totalXP: 600, level: 3, levelName: 'Quick Learner', streak: 1, progress: 0.2, xpToNextLevel: 300, nextLevelXP: 900,
    });
    mockedXpService.getAchievements.mockResolvedValue({
      unlocked: [
        { key: 'first_quiz', name: 'First Quiz', description: 'd', icon: '🎯', pointsAwarded: 10, type: 'milestone' },
        { key: 'streak_7', name: 'Week Warrior', description: 'd2', icon: '🔥', pointsAwarded: 50, type: 'streak' },
      ],
      available: [],
      totalUnlocked: 2,
      totalAvailable: 2,
    });

    const celebration = makeCelebration();
    await checkCelebrations(celebration);

    expect(celebration.showAchievement).toHaveBeenCalledTimes(1);
    expect(celebration.showAchievement).toHaveBeenCalledWith({
      name: 'Week Warrior', description: 'd2', icon: '🔥', points: 50,
    });
  });

  it('fires for a same-category, different-key achievement (regression for the mobile .type bug)', async () => {
    // Both achievements share `type: 'streak'` but have distinct keys -- diffing by
    // key (not type/category) must still detect the new one.
    localStorage.setItem('lastKnownLevel', '3');
    localStorage.setItem('lastKnownAchievements', JSON.stringify(['streak_7']));
    mockedXpService.getProfile.mockResolvedValue({
      totalXP: 900, level: 3, levelName: 'Quick Learner', streak: 30, progress: 0, xpToNextLevel: 0, nextLevelXP: 900,
    });
    mockedXpService.getAchievements.mockResolvedValue({
      unlocked: [
        { key: 'streak_7', name: 'Week Warrior', description: 'd', icon: '🔥', pointsAwarded: 50, type: 'streak' },
        { key: 'streak_30', name: 'Monthly Master', description: 'd2', icon: '🔥', pointsAwarded: 150, type: 'streak' },
      ],
      available: [],
      totalUnlocked: 2,
      totalAvailable: 2,
    });

    const celebration = makeCelebration();
    await checkCelebrations(celebration);

    expect(celebration.showAchievement).toHaveBeenCalledTimes(1);
    expect(celebration.showAchievement).toHaveBeenCalledWith({
      name: 'Monthly Master', description: 'd2', icon: '🔥', points: 150,
    });
  });

  it('resolves without throwing when the service rejects', async () => {
    mockedXpService.getProfile.mockRejectedValue(new Error('network error'));
    mockedXpService.getAchievements.mockRejectedValue(new Error('network error'));

    const celebration = makeCelebration();
    await expect(checkCelebrations(celebration)).resolves.toBeUndefined();
    expect(celebration.showLevelUp).not.toHaveBeenCalled();
    expect(celebration.showAchievement).not.toHaveBeenCalled();
  });
});
