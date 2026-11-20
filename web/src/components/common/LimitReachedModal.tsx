import React from 'react';
import ReactDOM from 'react-dom';
import { Lock, Sparkles } from 'lucide-react';
import { useLimitModalStore } from '@/store/limitModalStore';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/config/constants';

const LIMIT_TYPE_LABELS: Record<string, string> = {
  quiz: 'quizzes',
  flashcard: 'flashcard decks',
  file_upload: 'file uploads',
  chat: 'chat messages',
  export: 'exports',
  chart: 'charts',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  lifetime: 'lifetime',
  cumulative: 'lifetime',
};

const RESET_HINTS: Record<string, string> = {
  daily: 'Your limit resets tomorrow.',
  weekly: 'Your limit resets next week.',
};

export const LimitReachedModal: React.FC = () => {
  const isOpen = useLimitModalStore((s) => s.isOpen);
  const params = useLimitModalStore((s) => s.params);
  const close = useLimitModalStore((s) => s.close);

  if (!isOpen || !params) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  const { limitType, used, total, period } = params;
  const label = LIMIT_TYPE_LABELS[limitType] || limitType;
  const periodLabel = period ? PERIOD_LABELS[period] || period : 'period';
  const resetHint = period ? RESET_HINTS[period] : undefined;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="pg-card shadow-clay-coral max-w-md w-full p-6 text-center">
        <div className="w-16 h-16 rounded-xl bg-pg-coral/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-10 h-10 text-pg-coral" />
        </div>
        <h3 className="text-xl font-heading font-bold text-pg-navy mb-2">Limit reached</h3>
        <p className="text-pg-text-secondary font-body mb-2">
          You&apos;ve used {used}/{total} {label} for this {periodLabel}.
        </p>
        {resetHint && (
          <p className="text-sm text-pg-text-secondary font-body mb-4">{resetHint}</p>
        )}
        <p className="text-pg-text-secondary font-body mb-6">
          Upgrade on the app to unlock unlimited access.
        </p>

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
          onClick={close}
          className="w-full pg-btn pg-btn-outline justify-center"
        >
          Dismiss
        </button>
      </div>
    </div>,
    modalRoot
  );
};

export default LimitReachedModal;
