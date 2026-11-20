import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Lock } from 'lucide-react';
import { BrainLifting } from '@/components/common/BrainLifting';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { PaywallScreen } from '@/pages/PaywallScreen';

export const ProtectedRoute: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const tier = useAuthStore((state) => state.tier);
  const refreshTier = useAuthStore((state) => state.refreshTier);
  const { isWebLoginEnabled, isLoading: isCheckingFlags } = useFeatureFlags();
  const [tierLoaded, setTierLoaded] = useState(tier !== null);

  // Ensure we have the latest tier before deciding paywall vs app.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (tier !== null) {
      setTierLoaded(true);
      return;
    }
    refreshTier().finally(() => setTierLoaded(true));
  }, [isAuthenticated, tier, refreshTier]);

  if (isCheckingFlags) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pg-cream">
        <BrainLifting message="Checking system status..." size="sm" />
      </div>
    );
  }

  if (!isWebLoginEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pg-cream p-4">
        <div className="max-w-md w-full pg-card shadow-clay-coral p-8 text-center">
          <img src={BrainLiftLogo} alt="BrainLift" className="h-20 w-auto mx-auto mb-4" />
          <div className="w-16 h-16 rounded-xl bg-pg-coral/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-pg-coral" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-pg-navy mb-2">
            Access Restricted
          </h2>
          <p className="text-pg-text-secondary font-body mb-6">
            Web access is currently disabled. Please try again later or use the mobile app.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full pg-btn pg-btn-coral justify-center"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  // Block until we know the tier — prevents flashing the dashboard before showing paywall.
  if (!tierLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pg-cream">
        <BrainLifting message="Loading..." size="sm" />
      </div>
    );
  }

  // Only a confirmed free tier gets the paywall. Unknown tier (transient
  // fetch failure leaves tier === null) falls through to the app: the server
  // enforces the paywall regardless (402 → refreshTier → re-render here), and
  // failing closed would flash the paywall at paying users on a network blip.
  if (tier === 'free') {
    return <PaywallScreen />;
  }

  return <Outlet />;
};
