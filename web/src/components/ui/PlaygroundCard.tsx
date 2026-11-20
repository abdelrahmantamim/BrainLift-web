import React from 'react';
import type { AccentColor } from '@/styles/playground-theme';

interface PlaygroundCardProps {
  children: React.ReactNode;
  accent?: AccentColor;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const accentClasses: Record<AccentColor, { shadow: string; hoverShadow: string }> = {
  coral: { shadow: 'shadow-clay-coral', hoverShadow: 'hover:shadow-clay-coral-hover' },
  yellow: { shadow: 'shadow-clay-yellow', hoverShadow: 'hover:shadow-clay-yellow-hover' },
  teal: { shadow: 'shadow-clay-teal', hoverShadow: 'hover:shadow-clay-teal-hover' },
  lilac: { shadow: 'shadow-clay-lilac', hoverShadow: 'hover:shadow-clay-lilac-hover' },
};

const paddingClasses = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const PlaygroundCard: React.FC<PlaygroundCardProps> = ({
  children,
  accent = 'coral',
  className = '',
  onClick,
  hoverable = true,
  padding = 'md',
}) => {
  const { shadow, hoverShadow } = accentClasses[accent];

  return (
    <div
      className={`
        bg-pg-surface border-[length:var(--pg-border-width)] border-pg-navy
        rounded-card ${paddingClasses[padding]}
        ${shadow}
        ${hoverable ? `${hoverShadow} hover:-translate-y-1 cursor-pointer` : ''}
        transition-all duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {children}
    </div>
  );
};

export default PlaygroundCard;
