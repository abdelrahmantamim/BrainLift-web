import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  MoreVertical,
  Play,
  Trash2,
  Edit3,
  Share2,
  Clock,
  Layers,
  CheckCircle,
  FileDown,
  Loader2,
} from 'lucide-react';
import type { FlashcardDeck } from '@/types/flashcard.types';
import { cn } from '@/lib/utils';
import { safeFormatDistanceToNow } from '@/utils/dateUtils';
import { ShareModal } from '@/components/common/ShareModal';
import { flashcardService } from '@/services/flashcard.service';
import { pdfService } from '@/services/pdf.service';
import toast from 'react-hot-toast';

interface FlashcardDeckCardProps {
  deck: FlashcardDeck;
  onStudy: (deck: FlashcardDeck) => void;
  onReview?: (deck: FlashcardDeck) => void;
  onDelete: (deck: FlashcardDeck) => void;
  onRename: (deck: FlashcardDeck) => void;
  onShare?: (deck: FlashcardDeck) => void;
  onClick?: (deck: FlashcardDeck) => void;
  viewMode?: 'grid' | 'list';
}

// Rotating shadow colors for visual variety
const shadowColors = ['shadow-clay-coral', 'shadow-clay-teal', 'shadow-clay-yellow', 'shadow-clay-lilac'];

export const FlashcardDeckCard: React.FC<FlashcardDeckCardProps> = ({
  deck,
  onStudy,
  onDelete,
  onRename,
  onClick,
  viewMode = 'grid',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const handleExportPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setIsExportingPDF(true);
    try {
      const deckData = await flashcardService.getDeck(deck.id);
      const blob = await pdfService.generatePDF({
        content: JSON.stringify({
          title: deck.name,
          cards: deckData.cards.map((c: { question: string; answer: string }) => ({
            front: c.question,
            back: c.answer,
          })),
        }),
        type: 'flashcards',
        title: deck.name,
      });
      pdfService.downloadPDF(blob, `flashcards-${deck.name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const hasDueCards = (deck.dueCount ?? 0) > 0;
  const percentageDue = (deck.cardCount ?? 0) > 0 ? ((deck.dueCount ?? 0) / (deck.cardCount ?? 0)) * 100 : 0;

  // Consistent shadow color per deck based on deck ID
  const shadowColor = shadowColors[parseInt(deck.id?.substring(0, 8) || '0', 16) % shadowColors.length];

  useEffect(() => {
    if (showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
    }
  }, [showMenu]);

  const dropdownMenu = showMenu && menuPos ? ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(false);
        }}
      />
      <div
        className="fixed z-[9999] bg-pg-surface border-2 border-pg-navy rounded-xl shadow-clay-coral overflow-hidden min-w-[160px]"
        style={{ top: menuPos.top, left: menuPos.left - 160 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename(deck);
            setShowMenu(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left font-body text-pg-navy"
        >
          <Edit3 className="w-4 h-4" />
          Rename
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowShareModal(true);
            setShowMenu(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left font-body text-pg-navy"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
        <button
          onClick={handleExportPDF}
          disabled={isExportingPDF}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left font-body text-pg-navy disabled:opacity-50"
        >
          {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {isExportingPDF ? 'Exporting...' : 'Export PDF'}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(deck);
            setShowMenu(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left font-body text-pg-coral"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </>,
    document.getElementById('modal-root') as HTMLElement
  ) : null;

  if (viewMode === 'list') {
    return (
      <div
        className={cn("border-3 border-pg-navy rounded-2xl bg-pg-surface group hover:translate-y-[-2px] transition-[transform,box-shadow] duration-200 cursor-pointer", shadowColor)}
        onClick={() => onClick?.(deck)}
      >
        <div className="p-4 flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-pg-teal/20 border-2 border-pg-navy flex items-center justify-center flex-shrink-0">
            <Layers className="w-6 h-6 text-pg-teal" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-heading text-lg text-pg-navy truncate">{deck.name}</h3>
              {deck.category && deck.category !== 'general' && (
                <span className="bg-pg-lilac/20 border border-pg-navy/30 rounded-full px-2 py-0.5 text-xs font-body text-pg-lilac">
                  {deck.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm font-body text-pg-text-secondary">
              <span className="bg-pg-yellow/20 border-2 border-pg-navy rounded-full px-3 py-1 font-heading text-sm text-pg-navy">{deck.cardCount ?? 0} cards</span>
              {hasDueCards && (
                <span className="text-pg-yellow">{deck.dueCount ?? 0} due</span>
              )}
              {deck.tags && deck.tags.length > 0 && (
                <div className="flex gap-1">
                  {deck.tags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="bg-pg-lilac/20 border border-pg-navy/30 rounded-full px-2 py-0.5 text-xs font-body">
                      {tag}
                    </span>
                  ))}
                  {deck.tags.length > 2 && (
                    <span className="text-xs font-body">+{deck.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStudy(deck);
              }}
              className={cn(
                "px-4 py-2 font-body font-medium border-2 border-pg-navy rounded-xl transition-all duration-200 hover:translate-y-[-2px]",
                hasDueCards
                  ? "bg-pg-yellow text-pg-navy"
                  : "btn-gradient"
              )}
            >
              {hasDueCards ? 'Study' : 'Review'}
            </button>

            <button
              ref={menuBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {dropdownMenu}
          </div>
        </div>

        {/* Share Modal */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          contentType="flashcards"
          contentId={deck.id}
          title={deck.name ?? 'Untitled Deck'}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("border-3 border-pg-navy rounded-2xl bg-pg-surface group hover:translate-y-[-2px] transition-[transform,box-shadow] duration-200 cursor-pointer", shadowColor)}
      onClick={() => onClick?.(deck)}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-lg text-pg-navy truncate mb-1">{deck.name}</h3>
            {deck.fileName && (
              <p className="text-sm font-body text-pg-text-secondary truncate">From: {deck.fileName}</p>
            )}
          </div>

          {/* Actions Menu */}
          <button
            ref={menuBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {dropdownMenu}
        </div>

        {/* Category and Tags */}
        {(deck.category || deck.tags?.length) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {deck.category && deck.category !== 'general' && (
              <span className="bg-pg-lilac/20 border border-pg-navy/30 rounded-full px-2 py-0.5 text-xs font-body text-pg-lilac">
                {deck.category}
              </span>
            )}
            {deck.tags?.map((tag, i) => (
              <span key={i} className="bg-pg-lilac/20 border border-pg-navy/30 rounded-full px-2 py-0.5 text-xs font-body text-pg-text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm font-body">
          <div className="flex items-center gap-1 text-pg-text-secondary">
            <Layers className="w-4 h-4" />
            <span className="bg-pg-yellow/20 border-2 border-pg-navy rounded-full px-3 py-1 font-heading text-sm text-pg-navy">{deck.cardCount ?? 0} cards</span>
          </div>

          {hasDueCards && (
            <div className="flex items-center gap-1 text-pg-yellow">
              <Clock className="w-4 h-4" />
              <span>{deck.dueCount ?? 0} due</span>
            </div>
          )}

          {deck.lastReviewed && (
            <div className="flex items-center gap-1 text-pg-text-secondary">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">{safeFormatDistanceToNow(deck.lastReviewed, { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {(deck.cardCount ?? 0) > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs font-body text-pg-text-secondary mb-1">
              <span>Progress</span>
              <span>{(deck.cardCount ?? 0) - (deck.dueCount ?? 0)} / {deck.cardCount ?? 0} mastered</span>
            </div>
            <div className="relative h-2 bg-pg-cream rounded-full overflow-hidden border-2 border-pg-navy">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-all duration-300",
                  hasDueCards
                    ? "bg-pg-yellow"
                    : "bg-pg-teal"
                )}
                style={{ width: `${100 - percentageDue}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick?.(deck);
            }}
            className="w-full py-3 btn-gradient font-heading rounded-xl text-white flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-transform"
          >
            <Play className="w-5 h-5" />
            Start Study
          </button>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        contentType="flashcards"
        contentId={deck.id}
        title={deck.name ?? 'Untitled Deck'}
      />
    </div>
  );
};
