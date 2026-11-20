import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Copy, Check, Globe, Lock, Clock, Eye, Link2, QrCode, Twitter, Facebook, MessageCircle, Send } from 'lucide-react';
import { sharingService } from '@/services/sharing.service';
import type { ShareOptions } from '@/services/sharing.service';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'quiz' | 'flashcards' | 'message' | 'content';
  contentId?: string;
  content?: string;
  title: string;
}

// Social intent URL builders — mirror mobile/src/services/ShareService.ts
// (generateTwitterLink/generateFacebookLink/generateWhatsAppLink/generateTelegramLink,
// lines ~269-301) exactly so both platforms produce the same share copy.
function buildTwitterLink(shareUrl: string, contentType: ShareModalProps['contentType'], title: string): string {
  const text = contentType === 'quiz'
    ? `🎯 Challenge yourself with "${title}" on @BrainLift! Test your knowledge and level up your learning 🚀`
    : `📚 Master "${title}" with spaced repetition flashcards on @BrainLift! Study smarter, not harder 🧠`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
}

function buildFacebookLink(shareUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
}

function buildWhatsAppLink(shareUrl: string, contentType: ShareModalProps['contentType'], title: string, description: string): string {
  const emoji = contentType === 'quiz' ? '🎯' : '📚';
  const action = contentType === 'quiz' ? 'Challenge yourself' : 'Master this topic';
  const feature = contentType === 'quiz'
    ? '✨ Multiple questions to test your knowledge'
    : '✨ Multiple flashcards with spaced repetition';

  const text = `${emoji} ${action} with "${title}"!\n\n${description}\n\n${feature}\n🚀 Study smarter with BrainLift's AI\n\n`;
  return `https://wa.me/?text=${encodeURIComponent(text + shareUrl)}`;
}

function buildTelegramLink(shareUrl: string, contentType: ShareModalProps['contentType'], title: string): string {
  const emoji = contentType === 'quiz' ? '🎯' : '📚';
  const text = contentType === 'quiz'
    ? `${emoji} Challenge yourself with "${title}" on BrainLift!`
    : `${emoji} Master "${title}" with AI-powered flashcards on BrainLift!`;
  return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  contentType,
  contentId,
  content,
  title,
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

  const [shareUrl, setShareUrl] = useState('');
  const [shareId, setShareId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [qrLoaded, setQrLoaded] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [options, setOptions] = useState<ShareOptions>({
    expiresIn: 24 * 7, // 1 week
    requiresAuth: false,
    maxImports: undefined,
  });

  const handleShare = async () => {
    setIsSharing(true);
    try {
      let response;

      switch (contentType) {
        case 'quiz':
          if (!contentId) throw new Error('Quiz ID is required');
          response = await sharingService.shareQuiz(contentId, options);
          break;
        case 'flashcards':
          if (!contentId) throw new Error('Deck ID is required');
          response = await sharingService.shareFlashcards(contentId, options);
          break;
        case 'message':
          if (!contentId) throw new Error('Message ID is required');
          response = await sharingService.shareMessage(contentId, options);
          break;
        case 'content':
          if (!content) throw new Error('Content is required');
          response = await sharingService.shareContent(content, title, options);
          break;
      }

      setShareUrl(response.shareUrl);
      setShareId(response.shareId);
      setQrCodeUrl(response.qrCodeUrl ?? '');
      setQrLoaded(false);
      toast.success('Share link created!');
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to create share link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleSocialShare = (channel: string, url: string) => {
    window.open(url, '_blank', 'noopener');
    void sharingService.trackEvent(shareId, 'share', { channel });
  };

  const handleCopy = async () => {
    try {
      await sharingService.copyShareUrl(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
      void sharingService.trackEvent(shareId, 'copy_link');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  if (!isOpen || !portalContainerRef.current) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-pg-navy/20">
          <h2 className="text-xl font-heading font-bold flex items-center gap-2 text-pg-navy">
            <Link2 className="w-5 h-5" />
            Share {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-pg-navy/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-pg-navy" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!shareUrl ? (
            <>
              {/* Sharing Options */}
              <div className="space-y-4">
                {/* Expiration */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-heading font-semibold mb-2 text-pg-navy">
                    <Clock className="w-4 h-4" />
                    Expires after
                  </label>
                  <select
                    value={options.expiresIn}
                    onChange={(e) => setOptions({ ...options, expiresIn: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-pg-surface border-2 border-pg-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-pg-coral font-body text-pg-text"
                  >
                    <option value={1}>1 hour</option>
                    <option value={24}>1 day</option>
                    <option value={24 * 7}>1 week</option>
                    <option value={24 * 30}>1 month</option>
                    <option value={0}>Never</option>
                  </select>
                </div>

                {/* Max Imports */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-heading font-semibold mb-2 text-pg-navy">
                    <Eye className="w-4 h-4" />
                    Maximum imports (optional)
                  </label>
                  <input
                    type="number"
                    value={options.maxImports || ''}
                    onChange={(e) => setOptions({ ...options, maxImports: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 bg-pg-surface border-2 border-pg-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-pg-coral placeholder-pg-text-secondary font-body text-pg-text"
                  />
                </div>

                {/* Require sign-in */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-heading font-semibold text-pg-navy cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.requiresAuth ?? false}
                      onChange={(e) => setOptions({ ...options, requiresAuth: e.target.checked })}
                      className="w-4 h-4 rounded border-2 border-pg-navy accent-pg-coral focus:outline-none focus:ring-2 focus:ring-pg-coral"
                    />
                    <Lock className="w-4 h-4" />
                    Require sign-in to import
                  </label>
                </div>
              </div>

              {/* Share Button */}
              <button
                onClick={handleShare}
                disabled={isSharing}
                className={cn(
                  "w-full py-3 font-heading font-semibold rounded-lg transition-all duration-200",
                  "btn-gradient text-white border-2 border-pg-navy shadow-clay-coral",
                  "hover:shadow-clay-coral-hover hover:-translate-y-1",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
              >
                {isSharing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Creating share link...
                  </>
                ) : (
                  <>
                    <Globe className="w-5 h-5" />
                    Create Share Link
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Share Link */}
              <div>
                <label className="flex items-center gap-2 text-sm font-heading font-semibold mb-2 text-pg-navy">
                  <Link2 className="w-4 h-4" />
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-pg-surface border-2 border-pg-navy rounded-lg text-sm font-body text-pg-text"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors flex items-center gap-2 font-body font-semibold text-pg-navy border-2 border-pg-navy"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-pg-teal" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="flex flex-col items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-heading font-semibold text-pg-navy self-start">
                    <QrCode className="w-4 h-4" />
                    QR Code
                  </label>
                  <div className="w-40 h-40 rounded-lg border-2 border-pg-navy bg-white p-2 flex items-center justify-center overflow-hidden">
                    {!qrLoaded && (
                      <div
                        data-testid="qr-skeleton"
                        className="w-full h-full rounded-md bg-pg-navy/10 animate-pulse"
                      />
                    )}
                    <img
                      src={qrCodeUrl}
                      alt={`QR code linking to ${title}`}
                      className={cn('w-full h-full object-contain', !qrLoaded && 'hidden')}
                      onLoad={() => setQrLoaded(true)}
                      onError={() => setQrLoaded(true)}
                    />
                  </div>
                </div>
              )}

              {/* Social Share Buttons */}
              <div>
                <label className="flex items-center gap-2 text-sm font-heading font-semibold mb-2 text-pg-navy">
                  Share via
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleSocialShare('twitter', buildTwitterLink(shareUrl, contentType, title))}
                    aria-label="Share on X (Twitter)"
                    className="p-3 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors flex items-center justify-center border-2 border-pg-navy text-pg-navy"
                  >
                    <Twitter className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleSocialShare('facebook', buildFacebookLink(shareUrl))}
                    aria-label="Share on Facebook"
                    className="p-3 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors flex items-center justify-center border-2 border-pg-navy text-pg-navy"
                  >
                    <Facebook className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleSocialShare('whatsapp', buildWhatsAppLink(shareUrl, contentType, title, content ?? title))}
                    aria-label="Share on WhatsApp"
                    className="p-3 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors flex items-center justify-center border-2 border-pg-navy text-pg-navy"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleSocialShare('telegram', buildTelegramLink(shareUrl, contentType, title))}
                    aria-label="Share on Telegram"
                    className="p-3 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors flex items-center justify-center border-2 border-pg-navy text-pg-navy"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Share Info */}
              <div className="bg-pg-teal/10 border-2 border-pg-teal rounded-lg p-4 space-y-2">
                <p className="text-sm text-pg-navy font-heading font-semibold">Share link created successfully!</p>
                <ul className="text-xs text-pg-text-secondary space-y-1 font-body">
                  {(options.expiresIn ?? 0) > 0 && (
                    <li>• Expires in {(options.expiresIn ?? 0) < 24 ? `${options.expiresIn} hour${(options.expiresIn ?? 0) > 1 ? 's' : ''}` : `${(options.expiresIn ?? 0) / 24} day${(options.expiresIn ?? 0) / 24 > 1 ? 's' : ''}`}</li>
                  )}
                  {options.maxImports && (
                    <li>• Limited to {options.maxImports} import{options.maxImports > 1 ? 's' : ''}</li>
                  )}
                  {options.requiresAuth && (
                    <li>• Requires sign-in to import</li>
                  )}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShareUrl('');
                    setShareId('');
                    setQrCodeUrl('');
                    setQrLoaded(false);
                    setOptions({
                      expiresIn: 24 * 7,
                      requiresAuth: false,
                      maxImports: undefined,
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-pg-navy/10 hover:bg-pg-navy/20 rounded-lg transition-colors border-2 border-pg-navy font-body font-semibold text-pg-navy"
                >
                  Create New Link
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-coral hover:shadow-clay-coral-hover hover:-translate-y-1 transition-all duration-200"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    portalContainerRef.current
  );
};
