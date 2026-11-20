import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Flag, X, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export type ReportReason = 'spam' | 'inappropriate' | 'malicious' | 'copyright' | 'other';

interface ReportContentModalProps {
  isOpen?: boolean;
  shareId: string;
  onClose: () => void;
}

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'malicious', label: 'Malicious or harmful' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'other', label: 'Other' },
];

type SubmitState = 'idle' | 'submitting' | 'success' | 'duplicate';

export const ReportContentModal: React.FC<ReportContentModalProps> = ({
  isOpen = true,
  shareId,
  onClose,
}) => {
  const portalContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalContainerRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<SubmitState>('idle');

  const handleSubmit = async () => {
    if (!reason) return;
    setState('submitting');
    try {
      await api.post('/share/report-content', {
        shareId,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setState('success');
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { error?: string } } };
      if (
        axiosError.response?.status === 400 &&
        axiosError.response?.data?.error?.toLowerCase().includes('already reported')
      ) {
        setState('duplicate');
      } else {
        // Any other failure: reset to idle so the user can retry. The
        // shared axios interceptor already surfaces a generic error toast.
        setState('idle');
      }
    }
  };

  if (!isOpen || !portalContainerRef.current) return null;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-pg-navy/20">
          <h2 className="text-xl font-heading font-bold flex items-center gap-2 text-pg-navy">
            <Flag className="w-5 h-5" />
            Report content
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-pg-navy/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-pg-navy" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {state === 'success' ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-pg-teal/20 border-2 border-pg-teal flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-pg-teal" />
              </div>
              <p className="text-pg-navy font-heading font-semibold">
                Thanks — our team will review this.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-coral hover:shadow-clay-coral-hover hover:-translate-y-1 transition-all duration-200"
              >
                Done
              </button>
            </div>
          ) : state === 'duplicate' ? (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-pg-yellow/20 border-2 border-pg-yellow flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-pg-navy" />
              </div>
              <p className="text-pg-navy font-heading font-semibold">Already reported</p>
              <p className="text-sm text-pg-text-secondary font-body">
                You've already reported this content. Our team is reviewing it.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors border-2 border-pg-navy font-body font-semibold text-pg-navy"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-heading font-semibold mb-2 text-pg-navy">
                  Why are you reporting this?
                </legend>
                {REASONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg border-2 cursor-pointer transition-colors font-body text-pg-text',
                      reason === value
                        ? 'border-pg-coral bg-pg-coral/10'
                        : 'border-pg-navy/20 hover:bg-pg-navy/5'
                    )}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="w-4 h-4 accent-pg-coral"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <div>
                <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Additional details (optional)"
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2 bg-pg-surface border-2 border-pg-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-pg-coral placeholder-pg-text-secondary font-body text-pg-text resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!reason || state === 'submitting'}
                className={cn(
                  'w-full py-3 font-heading font-semibold rounded-lg transition-all duration-200',
                  'btn-gradient text-white border-2 border-pg-navy shadow-clay-coral',
                  'hover:shadow-clay-coral-hover hover:-translate-y-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {state === 'submitting' ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="w-5 h-5" />
                    Submit report
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    portalContainerRef.current
  );
};
