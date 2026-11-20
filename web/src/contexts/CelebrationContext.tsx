import { createContext, useContext } from 'react';

export interface CelebrationContextType {
  showLevelUp: (levelName: string, level: number) => void;
  showAchievement: (a: { name: string; description?: string; icon?: string; points?: number }) => void;
  showConfetti: () => void;
}

export const CelebrationContext = createContext<CelebrationContextType | null>(null);

export const useCelebration = (): CelebrationContextType => {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within CelebrationProvider');
  return ctx;
};
