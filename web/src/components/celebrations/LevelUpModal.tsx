import React from 'react';
import ReactDOM from 'react-dom';
import { PlaygroundButton } from '../ui/PlaygroundButton';
import { ConfettiBurst } from './ConfettiBurst';

interface LevelUpModalProps {
  levelName: string;
  level: number;
  onClose: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ levelName, level, onClose }) => {
  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <ConfettiBurst onDone={() => {}} />
      <div className="relative border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-sm w-full p-8 text-center animate-celebrate-pop">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-heading font-bold text-pg-navy mb-2">Level Up!</h2>
        <p className="text-lg font-body text-pg-text-secondary mb-6">
          Level {level} — {levelName}
        </p>
        <PlaygroundButton variant="coral" fullWidth onClick={onClose}>
          Keep going!
        </PlaygroundButton>
      </div>
    </div>,
    document.getElementById('modal-root') as HTMLElement
  );
};

export default LevelUpModal;
