import React, { useEffect, useState, useRef } from 'react';
import BrainOnly from '@/assets/brain-only.png';
import BarbellWithArms from '@/assets/barbell-with-arms.png';

const SMART_SENTENCES = [
  "Analyzing content patterns...",
  "Extracting key concepts...",
  "Building personalized flashcards...",
  "Optimizing for your learning style...",
  "Creating spaced repetition schedule...",
  "Identifying important topics...",
  "Generating practice questions...",
  "Enhancing memory retention...",
  "Preparing study materials...",
  "Crafting intelligent summaries...",
  "Detecting knowledge gaps...",
  "Customizing difficulty levels...",
  "Organizing content hierarchy...",
  "Applying learning science...",
  "Maximizing recall potential...",
];

interface BrainLiftingProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrainLifting: React.FC<BrainLiftingProps> = ({ message, size = 'md' }) => {
  const [currentSentence, setCurrentSentence] = useState(0);
  const [fade, setFade] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const sizeMap = { sm: 80, md: 120, lg: 150 };
  const imgSize = sizeMap[size];

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentSentence((prev) => {
          const remaining = SMART_SENTENCES.filter((_, i) => i !== prev);
          const randomIdx = Math.floor(Math.random() * remaining.length);
          return SMART_SENTENCES.indexOf(remaining[randomIdx]);
        });
        setFade(true);
      }, 300);
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-5">
      <div className="relative mb-6" style={{ width: imgSize, height: imgSize }}>
        <img
          src={BrainOnly}
          alt="Brain"
          className="w-full h-full object-contain"
        />
        <img
          src={BarbellWithArms}
          alt="Barbell"
          className="absolute inset-0 w-full h-full object-contain animate-brain-lift"
        />
      </div>
      <p
        className={`text-pg-navy font-heading font-semibold text-center transition-opacity duration-300 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {SMART_SENTENCES[currentSentence]}
      </p>
      {message && (
        <p className="text-pg-text-secondary text-sm font-body text-center mt-2">{message}</p>
      )}
    </div>
  );
};
