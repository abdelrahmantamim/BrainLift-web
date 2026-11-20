import { xpService } from '../services/xp.service';

const LEVEL_KEY = 'lastKnownLevel';
const ACH_KEY = 'lastKnownAchievements';

type Celebration = {
  showLevelUp: (levelName: string, level: number) => void;
  showAchievement: (a: { name: string; description?: string; icon?: string; points?: number }) => void;
  showConfetti: () => void;
};

export async function checkCelebrations(celebration: Celebration): Promise<void> {
  try {
    const profile = await xpService.getProfile();
    const lastLevel = Number(localStorage.getItem(LEVEL_KEY) ?? '0');
    if (lastLevel > 0 && profile.level > lastLevel) {
      celebration.showLevelUp(profile.levelName, profile.level);
    }
    localStorage.setItem(LEVEL_KEY, String(profile.level));

    const data = await xpService.getAchievements();
    const known: string[] = JSON.parse(localStorage.getItem(ACH_KEY) ?? '[]');
    const unlockedKeys = data.unlocked.map(a => a.key);
    if (known.length > 0) {
      data.unlocked
        .filter(a => !known.includes(a.key))
        .forEach(a =>
          celebration.showAchievement({
            name: a.name, description: a.description, icon: a.icon, points: a.pointsAwarded,
          })
        );
    }
    localStorage.setItem(ACH_KEY, JSON.stringify(unlockedKeys));
  } catch {
    // Celebrations are best-effort; never surface errors.
  }
}
