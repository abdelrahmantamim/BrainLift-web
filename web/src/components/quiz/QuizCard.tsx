import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  MoreVertical,
  Play,
  Trash2,
  Edit3,
  Share2,
  Tag,
  Trophy,
  Clock,
  Hash,
  FileDown,
  Loader2,
} from 'lucide-react';
import type { Quiz } from '@/types/quiz.types';
import { QUIZ_CATEGORIES, DIFFICULTY_CONFIG } from '@/types/quiz.types';
import { cn } from '@/lib/utils';
import { safeFormatDistanceToNow } from '@/utils/dateUtils';
import { quizService } from '@/services/quiz.service';
import { pdfService } from '@/services/pdf.service';
import toast from 'react-hot-toast';
import { ShareModal } from '@/components/common/ShareModal';

interface QuizCardProps {
  quiz: Quiz;
  onPlay: (quiz: Quiz) => void;
  onDelete: (quiz: Quiz) => void;
  onRename: (quiz: Quiz) => void;
  onUpdateTags: (quiz: Quiz) => void;
  onClick?: (quiz: Quiz) => void;
  viewMode?: 'grid' | 'list';
}

// Rotating shadow colors based on index
const getShadowClass = (index: number) => {
  const shadows = ['shadow-clay-coral', 'shadow-clay-teal', 'shadow-clay-yellow', 'shadow-clay-lilac'];
  return shadows[index % 4];
};

let cardIndexCounter = 0;

export const QuizCard: React.FC<QuizCardProps> = ({
  quiz,
  onPlay,
  onDelete,
  onRename,
  onUpdateTags,
  onClick,
  viewMode = 'grid',
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [cardIndex] = useState(() => cardIndexCounter++);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const handleExportPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setIsExportingPDF(true);
    try {
      const fullQuiz = await quizService.getQuiz(quiz.id);
      const blob = await pdfService.generatePDF({
        content: JSON.stringify({
          title: fullQuiz.title,
          description: fullQuiz.description,
          questions: fullQuiz.questions.map((q: { question: string; options: string[]; correctAnswer: number; explanation?: string }) => ({
            question: q.question,
            options: q.options,
            correctAnswer: q.options[q.correctAnswer],
            explanation: q.explanation,
          })),
        }),
        type: 'quiz',
        title: fullQuiz.title,
      });
      pdfService.downloadPDF(blob, `quiz-${quiz.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const category = QUIZ_CATEGORIES.find(c => c.id === quiz.category) || QUIZ_CATEGORIES[4];
  const difficulty = quiz.difficulty ? DIFFICULTY_CONFIG[quiz.difficulty] : null;

  // Get difficulty color based on level
  const getDifficultyBadgeClass = (level: string) => {
    switch (level) {
      case 'easy':
        return 'bg-pg-teal/20 border-pg-teal text-pg-teal';
      case 'medium':
        return 'bg-pg-yellow/20 border-pg-yellow text-pg-yellow';
      case 'hard':
        return 'bg-pg-coral/20 border-pg-coral text-pg-coral';
      default:
        return 'bg-pg-indigo/20 border-pg-indigo text-pg-indigo';
    }
  };

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
        className="fixed z-[9999] bg-pg-surface border-2 border-pg-navy rounded-xl shadow-clay-navy overflow-hidden min-w-[160px]"
        style={{ top: menuPos.top, left: menuPos.left - 160 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename(quiz);
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
            onUpdateTags(quiz);
            setShowMenu(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left font-body text-pg-navy"
        >
          <Tag className="w-4 h-4" />
          Edit Tags
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
            onDelete(quiz);
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
        className={cn(
          "border-3 border-pg-navy rounded-2xl bg-pg-surface cursor-pointer hover:translate-y-[-2px] transition-all duration-200",
          getShadowClass(cardIndex)
        )}
        onClick={() => onClick?.(quiz)}
      >
        <div className="p-4 flex items-center gap-4">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-xl flex items-center justify-center text-lg flex-shrink-0 border-2 border-pg-navy overflow-hidden",
            category.gradient
          )}>
            <span className="leading-none">{category.icon}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-heading text-lg truncate text-pg-navy">{quiz.title}</h3>
              {difficulty && (
                <span className={cn(
                  "inline-flex px-3 py-1 rounded-full text-xs font-heading border-2",
                  getDifficultyBadgeClass(quiz.difficulty!)
                )}>
                  {difficulty.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm font-body text-pg-text-secondary">
              <span className="inline-flex items-center gap-1 bg-pg-yellow/20 border-2 border-pg-navy rounded-full px-3 py-1 font-heading text-sm">
                <Hash className="w-3.5 h-3.5" />
                {quiz.questionCount}
              </span>
              {quiz.attempts > 0 && quiz.bestScore !== undefined && (
                <span className="flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-pg-yellow" />
                  {quiz.bestScore}%
                </span>
              )}
              {quiz.tags && quiz.tags.length > 0 && (
                <div className="flex gap-1">
                  {quiz.tags.slice(0, 2).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs rounded-full border border-pg-navy bg-pg-cream font-body">
                      {tag}
                    </span>
                  ))}
                  {quiz.tags.length > 2 && (
                    <span className="text-xs font-body">+{quiz.tags.length - 2}</span>
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
                onPlay(quiz);
              }}
              className="btn-gradient px-4 py-2 font-heading rounded-xl text-white"
            >
              Play
            </button>

            <button
              ref={menuBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
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
          contentType="quiz"
          contentId={quiz.id}
          title={quiz.title}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-3 border-pg-navy rounded-2xl bg-pg-surface cursor-pointer hover:translate-y-[-2px] transition-all duration-200 group",
        getShadowClass(cardIndex)
      )}
      onClick={() => onClick?.(quiz)}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-xl flex items-center justify-center text-lg border-2 border-pg-navy overflow-hidden flex-shrink-0",
              category.gradient
            )}>
              <span className="leading-none">{category.icon}</span>
            </div>
            <div>
              <h3 className="font-heading text-lg line-clamp-1 text-pg-navy">{quiz.title}</h3>
              {quiz.description && (
                <p className="text-sm font-body text-pg-text-secondary line-clamp-1">{quiz.description}</p>
              )}
            </div>
          </div>

          {/* Actions Menu */}
          <button
            ref={menuBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors opacity-0 group-hover:opacity-100 text-pg-navy"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {dropdownMenu}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-4 text-sm flex-wrap">
          <span className="inline-flex items-center gap-1 bg-pg-yellow/20 border-2 border-pg-navy rounded-full px-3 py-1 font-heading text-sm">
            <Hash className="w-4 h-4" />
            {quiz.questionCount}
          </span>

          {quiz.bestScore !== undefined && (
            <span className="inline-flex items-center gap-1 bg-pg-yellow/20 border-2 border-pg-navy rounded-full px-3 py-1 font-heading text-sm">
              <Trophy className="w-4 h-4 text-pg-yellow" />
              {quiz.bestScore}/{quiz.questionCount}
            </span>
          )}

          {quiz.lastAttempt && (
            <span className="flex items-center gap-1 font-body text-pg-text-secondary">
              <Clock className="w-4 h-4" />
              {safeFormatDistanceToNow(quiz.lastAttempt, { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Tags */}
        {(difficulty || (quiz.tags && quiz.tags.length > 0)) && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {difficulty && (
              <span className={cn(
                "inline-flex px-3 py-1 rounded-full text-xs font-heading border-2",
                getDifficultyBadgeClass(quiz.difficulty!)
              )}>
                {difficulty.label}
              </span>
            )}
            {quiz.tags?.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs border border-pg-navy bg-pg-cream font-body text-pg-navy"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(quiz);
          }}
          className="w-full py-3 btn-gradient font-heading rounded-xl text-white flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-transform"
        >
          <Play className="w-5 h-5" />
          Start Quiz
        </button>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        contentType="quiz"
        contentId={quiz.id}
        title={quiz.title}
      />
    </div>
  );
};
