import React from 'react';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

type MascotMood = 'happy' | 'thinking' | 'encouraging' | 'celebrating' | 'idle' | 'waving';

interface MascotReactionProps {
  mood?: MascotMood;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  className?: string;
  showBubble?: boolean;
}

const sizeMap = {
  sm: 48,
  md: 80,
  lg: 120,
  xl: 180,
};

const moodAnimations: Record<MascotMood, string> = {
  happy: 'animate-hero-bounce',
  thinking: 'animate-wobble',
  encouraging: 'animate-float',
  celebrating: 'animate-celebrate-pop',
  idle: 'animate-brain-lift',
  waving: 'animate-wobble',
};

export const MascotReaction: React.FC<MascotReactionProps> = ({
  mood = 'idle',
  size = 'md',
  message,
  className = '',
  showBubble = true,
}) => {
  const px = sizeMap[size];

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative">
        <img
          src={BrainLiftLogo}
          alt="BrainLift mascot"
          className={`${moodAnimations[mood]} drop-shadow-md`}
          style={{ width: px, height: 'auto' }}
        />
        {mood === 'celebrating' && (
          <>
            <span className="absolute -top-2 -left-2 text-xl animate-float">*</span>
            <span className="absolute -top-1 -right-3 text-lg animate-float" style={{ animationDelay: '0.3s' }}>*</span>
            <span className="absolute -bottom-1 left-0 text-sm animate-float" style={{ animationDelay: '0.6s' }}>*</span>
          </>
        )}
      </div>
      {message && showBubble && (
        <div className="bg-pg-surface border-2 border-pg-navy rounded-card px-4 py-2 text-sm font-body text-pg-text text-center max-w-[200px] shadow-clay-coral relative">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-pg-navy" />
          <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-pg-surface" />
          {message}
        </div>
      )}
    </div>
  );
};

export default MascotReaction;
