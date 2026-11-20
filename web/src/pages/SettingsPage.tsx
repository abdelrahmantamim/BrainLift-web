import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon, Monitor, ShieldAlert, RotateCcw, User } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useUIStore, type ThemeMode } from '@/store/uiStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { BlocklistSection } from '@/components/settings/BlocklistSection';
import { Modal } from '@/components/common/Modal';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="w-5 h-5" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="w-5 h-5" /> },
  { value: 'system', label: 'System', icon: <Monitor className="w-5 h-5" /> },
];

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useUIStore();
  const refreshAll = useDashboardStore((state) => state.refreshAll);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetStats = async () => {
    setIsResetting(true);
    try {
      await api.post('/user/reset-stats');
      toast.success('Your statistics have been reset');
      setShowResetModal(false);
      await refreshAll();
    } catch (error) {
      console.error('Failed to reset stats:', error);
      toast.error('Failed to reset statistics');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-pg-navy">Settings</h1>
        <p className="text-pg-text-secondary font-body mt-1">
          Manage your appearance, privacy, and account preferences.
        </p>
      </div>

      {/* Appearance */}
      <section className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-yellow p-6">
        <h2 className="text-lg font-heading font-bold text-pg-navy mb-4">Appearance</h2>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTheme(option.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-body font-semibold transition-colors ${
                  isActive
                    ? 'border-pg-coral bg-pg-coral/10 text-pg-coral'
                    : 'border-pg-navy/20 text-pg-navy hover:bg-pg-cream/60'
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Privacy & Safety */}
      <section>
        <h2 className="text-lg font-heading font-bold text-pg-navy mb-4">Privacy &amp; Safety</h2>
        <BlocklistSection />
      </section>

      {/* Data */}
      <section className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal p-6">
        <div className="flex items-center gap-2 mb-4">
          <RotateCcw className="w-5 h-5 text-pg-navy" />
          <h2 className="text-lg font-heading font-bold text-pg-navy">Data</h2>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-heading font-semibold text-pg-navy">Reset statistics</p>
            <p className="text-sm text-pg-text-secondary font-body">
              Clears your quiz history and learning statistics. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 text-sm font-heading font-semibold rounded-lg border-2 border-pg-coral text-pg-coral bg-pg-coral/10 hover:bg-pg-coral/20 transition-colors flex-shrink-0"
          >
            Reset statistics
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-lilac p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-pg-navy" />
          <h2 className="text-lg font-heading font-bold text-pg-navy">Account</h2>
        </div>
        <Link
          to="/profile"
          className="inline-flex items-center px-4 py-2 text-sm font-heading font-semibold rounded-lg border-2 border-pg-navy text-pg-navy hover:bg-pg-cream transition-colors"
        >
          Go to Profile
        </Link>
      </section>

      {/* Reset confirmation modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset statistics?"
      >
        <div className="flex items-start gap-3 mb-6">
          <ShieldAlert className="w-6 h-6 text-pg-coral flex-shrink-0 mt-0.5" />
          <p className="text-pg-text-secondary font-body">
            This will permanently delete your quiz history and learning statistics. This action
            cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowResetModal(false)}
            disabled={isResetting}
            className="px-4 py-2 rounded-lg hover:bg-pg-cream transition-colors font-body font-semibold text-pg-navy disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResetStats}
            disabled={isResetting}
            className="px-4 py-2 bg-pg-coral text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isResetting ? 'Resetting...' : 'Reset statistics'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
