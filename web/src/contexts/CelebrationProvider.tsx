import React, { useState, useCallback, useRef } from 'react';
import { CelebrationContext, CelebrationContextType } from './CelebrationContext';
import { ConfettiBurst } from '../components/celebrations/ConfettiBurst';
import { LevelUpModal } from '../components/celebrations/LevelUpModal';
import { showAchievementToast } from '../components/celebrations/achievementToast';

type CelebrationItem =
  | { type: 'confetti' }
  | { type: 'levelUp'; levelName: string; level: number };

export const CelebrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [current, setCurrent] = useState<CelebrationItem | null>(null);
  const queue = useRef<CelebrationItem[]>([]);

  const advance = useCallback(() => {
    const next = queue.current.shift() ?? null;
    setCurrent(next);
  }, []);

  const enqueue = useCallback((item: CelebrationItem) => {
    setCurrent(cur => {
      if (cur) { queue.current.push(item); return cur; }
      return item;
    });
  }, []);

  const value: CelebrationContextType = {
    showLevelUp: (levelName, level) => enqueue({ type: 'levelUp', levelName, level }),
    showConfetti: () => enqueue({ type: 'confetti' }),
    // Toasts stack fine on their own — bypass the queue.
    showAchievement: a => showAchievementToast(a),
  };

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      {current?.type === 'confetti' && <ConfettiBurst onDone={advance} />}
      {current?.type === 'levelUp' && (
        <LevelUpModal levelName={current.levelName} level={current.level} onClose={advance} />
      )}
    </CelebrationContext.Provider>
  );
};
