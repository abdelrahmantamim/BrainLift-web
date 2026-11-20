import React, { useEffect, useState } from 'react';
import { getLevelForXP, getXPProgress } from '@/styles/playground-theme';
import { Star } from 'lucide-react';

interface XPBarProps {
  currentXP: number;
  animated?: boolean;
  showLabel?: boolean;
  showHint?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  level?: number;
  levelName?: string;
}

export const XPBar: React.FC<XPBarProps> = ({
  currentXP,
  animated = true,
  showLabel = true,
  showHint = false,
  size = 'md',
  className = '',
  level: serverLevel,
  levelName: serverLevelName,
}) => {
  const [displayWidth, setDisplayWidth] = useState(animated ? 0 : getXPProgress(currentXP) * 100);
  const localLevel = getLevelForXP(currentXP);
  // Server-provided level/levelName take precedence over the local lookup when both are given.
  const level =
    serverLevel !== undefined && serverLevelName !== undefined
      ? { ...localLevel, level: serverLevel, name: serverLevelName }
      : localLevel;
  const progress = getXPProgress(currentXP) * 100;

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setDisplayWidth(progress), 300);
      return () => clearTimeout(timer);
    }
    setDisplayWidth(progress);
  }, [currentXP, animated, progress]);

  const heightClass = size === 'sm' ? 'h-3' : size === 'lg' ? 'h-6' : 'h-5';
  const xpToNext = level.maxXP === Infinity ? 'MAX' : `${level.maxXP - currentXP} XP to next`;

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="font-heading font-semibold text-sm text-pg-text">
            {currentXP.toLocaleString()} XP
          </span>
          <span className="pg-level-badge">
            <Star size={12} />
            Lv.{level.level} {level.name}
          </span>
        </div>
      )}
      <div className={`pg-xp-track ${heightClass}`}>
        <div
          className="pg-xp-fill"
          style={{ width: `${displayWidth}%` }}
        />
      </div>
      {showHint && (
        <p className="mt-1.5 text-xs text-pg-text-secondary italic">
          {xpToNext}
        </p>
      )}
    </div>
  );
};

export default XPBar;
