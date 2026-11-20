import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  className?: string;
  format?: (value: number) => string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  className = '',
  format = (v: number) => v.toString()
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isString, setIsString] = useState(typeof value === 'string');
  
  useEffect(() => {
    // Handle string values (like "7 days", "24h")
    if (typeof value === 'string') {
      setIsString(true);
      return;
    }

    setIsString(false);
    const numericValue = Number(value);
    
    if (isNaN(numericValue)) return;

    const startValue = displayValue;
    const difference = numericValue - startValue;
    const steps = Math.ceil(duration / 16); // 60fps
    const stepValue = difference / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const newValue = startValue + (stepValue * currentStep);
      
      if (currentStep >= steps) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(newValue));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration, displayValue]);

  return (
    <span className={`transition-all duration-300 ${className}`}>
      {isString ? value : format(displayValue)}
    </span>
  );
};

export default AnimatedCounter;