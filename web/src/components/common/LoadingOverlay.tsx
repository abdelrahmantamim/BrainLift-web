import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-pg-cream flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-pg-coral animate-spin" />
        <p className="text-lg text-pg-text-secondary font-body">Loading...</p>
      </div>
    </div>
  );
};
