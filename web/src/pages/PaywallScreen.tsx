import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, RefreshCw, LogOut, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/config/constants';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

const POLL_INTERVAL_MS = 15_000;

export const PaywallScreen: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const tier = useAuthStore((s) => s.tier);
  const refreshTier = useAuthStore((s) => s.refreshTier);
  const logout = useAuthStore((s) => s.logout);
  const [isChecking, setIsChecking] = useState(false);

  // Auto-redirect when tier flips to paid (any non-free, non-null tier)
  useEffect(() => {
    if (tier && tier !== 'free') {
      navigate('/dashboard', { replace: true });
    }
  }, [tier, navigate]);

  // Background poll (clearInterval on unmount stops further ticks)
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshTier();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshTier]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      await refreshTier();
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pg-cream p-4">
      <div className="max-w-lg w-full pg-card shadow-clay-coral p-8 text-center">
        <img src={BrainLiftLogo} alt="BrainLift" className="h-20 w-auto mx-auto mb-4" />
        <div className="w-16 h-16 rounded-xl bg-pg-coral/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-10 h-10 text-pg-coral" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-pg-navy mb-2">
          Web access is for subscribers
        </h2>
        <p className="text-pg-text-secondary font-body mb-6">
          Open BrainLift on your phone, subscribe, then come back here.
          Your account will unlock automatically.
        </p>

        {user?.email && (
          <div className="text-xs font-body text-pg-text-secondary mb-6">
            Signed in as <span className="font-bold">{user.email}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pg-btn pg-btn-teal justify-center flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            App Store
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pg-btn pg-btn-teal justify-center flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Google Play
          </a>
        </div>

        <button
          onClick={handleManualCheck}
          disabled={isChecking}
          className="w-full pg-btn pg-btn-coral justify-center mb-3 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : "I've subscribed — check now"}
        </button>

        <button
          onClick={handleLogout}
          className="w-full pg-btn pg-btn-outline justify-center flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>

        <p className="text-xs text-pg-text-secondary mt-6 font-body">
          We check your subscription every {POLL_INTERVAL_MS / 1000} seconds.
        </p>
      </div>
    </div>
  );
};

export default PaywallScreen;
