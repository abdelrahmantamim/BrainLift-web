import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';

interface ConfettiBurstProps {
  onDone: () => void;
}

const COLORS = ['#FF8585', '#FFE066', '#5FE0D8', '#D4BEE8'];

interface Piece {
  id: number;
  left: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rounded: boolean;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: COLORS[i % COLORS.length],
    size: 8 + Math.random() * 4,
    delay: Math.random() * 0.6,
    duration: 1.4 + Math.random() * 0.8,
    drift: (Math.random() - 0.5) * 120,
    rounded: Math.random() > 0.5,
  }));
}

export const ConfettiBurst: React.FC<ConfettiBurstProps> = ({ onDone }) => {
  const pieces = useMemo(() => makePieces(40), []);

  useEffect(() => {
    const timer = setTimeout(onDone, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  const modalRoot = document.getElementById('modal-root') ?? document.body;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[9998]" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) translateX(var(--confetti-drift, 0px)) rotate(360deg); opacity: 0.9; }
        }
      `}</style>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.rounded ? '50%' : '2px',
            animation: `confetti-fall ${piece.duration}s linear ${piece.delay}s forwards`,
            ['--confetti-drift' as string]: `${piece.drift}px`,
          }}
        />
      ))}
    </div>,
    modalRoot
  );
};

export default ConfettiBurst;
