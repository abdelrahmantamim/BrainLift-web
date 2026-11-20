import React from 'react';
import { Link } from 'react-router-dom';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-pg-cream flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute w-40 h-40 rounded-full border-3 border-pg-yellow/30 bg-pg-yellow/10 -top-10 -right-10 animate-float" />
      <div className="absolute w-28 h-28 rounded-full border-3 border-pg-teal/30 bg-pg-teal/10 bottom-20 -left-10 animate-float" style={{ animationDelay: '1s' }} />
      <div className="absolute w-16 h-16 rounded-full border-3 border-pg-coral/30 bg-pg-coral/10 top-1/4 left-10 animate-float" style={{ animationDelay: '0.5s' }} />
      <div className="absolute w-20 h-20 rounded-full border-3 border-pg-lilac/30 bg-pg-lilac/10 bottom-10 right-20 animate-float" style={{ animationDelay: '1.5s' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Back to home link */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
            <img src={BrainLiftLogo} alt="BrainLift" className="h-10 w-auto animate-hero-bounce" />
            <span className="font-heading font-bold text-xl text-pg-navy">BrainLift</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
};
