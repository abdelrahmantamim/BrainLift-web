import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Sparkles, FileText, StickyNote, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { flashcardService } from '@/services/flashcard.service';
import { fileService } from '@/services/file.service';
import { useFlashcardStore } from '@/store/flashcardStore';
import toast from 'react-hot-toast';
import { checkAndGate, invalidateCache } from '@/utils/limits';

const flashcardGenerationSchema = z.object({
  mode: z.enum(['files', 'topic', 'notes']),
  topic: z.string().optional().transform(v => v === '' ? undefined : v).pipe(z.string().min(3, 'Topic must be at least 3 characters').optional()),
  fileIds: z.array(z.string()).optional(),
  notes: z.string().optional().transform(v => v === '' ? undefined : v).pipe(z.string().min(10, 'Notes must be at least 10 characters').optional()),
  cardCount: z.number().min(5, 'Minimum 5 cards').max(15, 'Maximum 15 cards').optional(),
  additionalContext: z.string().optional(),
});

type FlashcardGenerationForm = z.infer<typeof flashcardGenerationSchema>;

interface FlashcardGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFileId?: string | null;
  defaultMode?: 'topic' | 'files' | 'notes';
}

export const FlashcardGenerationModal: React.FC<FlashcardGenerationModalProps> = ({
  isOpen,
  onClose,
  preselectedFileId,
  defaultMode,
}) => {
  const [mode, setMode] = useState<'files' | 'topic' | 'notes'>(preselectedFileId ? 'files' : (defaultMode || 'topic'));
  const [files, setFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fetchDecks = useFlashcardStore((state) => state.fetchDecks);
  const portalContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalContainerRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FlashcardGenerationForm>({
    resolver: zodResolver(flashcardGenerationSchema),
    defaultValues: {
      mode: preselectedFileId ? 'files' : (defaultMode || 'topic'),
      cardCount: 10,
      fileIds: preselectedFileId ? [preselectedFileId] : [],
    },
  });

  // Load files when switching to files mode
  React.useEffect(() => {
    if (mode === 'files' && files.length === 0) {
      loadFiles();
    }
  }, [mode, files.length]);

  // Set preselected file and mode when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedFileId) {
        setMode('files');
        setValue('mode', 'files');
        setValue('fileIds', [preselectedFileId]);
      } else if (defaultMode) {
        setMode(defaultMode);
        setValue('mode', defaultMode);
      }
    }
  }, [preselectedFileId, defaultMode, isOpen, setValue]);

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const userFiles = await fileService.getFiles();
      setFiles(userFiles.map(f => ({ id: f.id, name: f.fileName })));
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const onSubmit = async (data: FlashcardGenerationForm) => {
    if (!(await checkAndGate('flashcard', 'flashcard_generation'))) return;

    setIsLoading(true);
    try {
      const params = {
        mode,
        topic: mode === 'topic' ? data.topic : undefined,
        fileIds: mode === 'files' ? data.fileIds : undefined,
        notes: mode === 'notes' ? data.notes : undefined,
        cardCount: data.cardCount,
        additionalContext: data.additionalContext,
      };

      await flashcardService.generateFlashcards(params);
      invalidateCache();
      toast.success('Flashcard deck generated successfully!');
      setIsLoading(false);
      onClose();
      await fetchDecks();
    } catch {
      toast.error('Failed to generate flashcards');
      setIsLoading(false);
    }
  };

  if (!isOpen || !portalContainerRef.current) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-pg-navy">
          <h2 className="text-2xl font-heading text-pg-navy flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pg-coral" />
            Create Flashcard Deck
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6">
          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-body font-medium text-pg-navy mb-3">Creation Mode</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('topic');
                  setValue('mode', 'topic');
                }}
                className={cn(
                  "p-4 rounded-xl border-2 border-pg-navy transition-all duration-200 font-body",
                  mode === 'topic'
                    ? "bg-pg-coral/20"
                    : "bg-pg-surface hover:bg-pg-cream"
                )}
              >
                <Sparkles className="w-6 h-6 mx-auto mb-2 text-pg-coral" />
                <p className="font-heading text-pg-navy">From Topic</p>
                <p className="text-sm text-pg-text-secondary mt-1">AI generates from topic</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('files');
                  setValue('mode', 'files');
                }}
                className={cn(
                  "p-4 rounded-xl border-2 border-pg-navy transition-all duration-200 font-body",
                  mode === 'files'
                    ? "bg-pg-teal/20"
                    : "bg-pg-surface hover:bg-pg-cream"
                )}
              >
                <FileText className="w-6 h-6 mx-auto mb-2 text-pg-teal" />
                <p className="font-heading text-pg-navy">From Files</p>
                <p className="text-sm text-pg-text-secondary mt-1">Extract from documents</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('notes');
                  setValue('mode', 'notes');
                }}
                className={cn(
                  "p-4 rounded-xl border-2 border-pg-navy transition-all duration-200 font-body",
                  mode === 'notes'
                    ? "bg-pg-lilac/20"
                    : "bg-pg-surface hover:bg-pg-cream"
                )}
              >
                <StickyNote className="w-6 h-6 mx-auto mb-2 text-pg-lilac" />
                <p className="font-heading text-pg-navy">From Notes</p>
                <p className="text-sm text-pg-text-secondary mt-1">Convert notes to cards</p>
              </button>
            </div>
          </div>

          {/* Topic Input */}
          {mode === 'topic' && (
            <div className="mb-6">
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Topic *</label>
              <input
                {...register('topic')}
                placeholder="e.g., Spanish Vocabulary, Human Anatomy, JavaScript Concepts"
                className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral font-body"
              />
              {errors.topic && (
                <p className="text-pg-coral text-sm mt-1 font-body">{errors.topic.message}</p>
              )}
            </div>
          )}

          {/* File Selection */}
          {mode === 'files' && (
            <div className="mb-6">
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Select Files *</label>
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-pg-teal" />
                </div>
              ) : files.length === 0 ? (
                <p className="text-pg-text-secondary text-center py-8 font-body">No files uploaded yet</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file) => (
                    <label
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-pg-navy/5 border-2 border-pg-navy rounded-xl hover:bg-pg-cream cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={file.id}
                        checked={(watch('fileIds') || []).includes(file.id)}
                        onChange={(e) => {
                          const currentIds = watch('fileIds') || [];
                          if (e.target.checked) {
                            setValue('fileIds', [...currentIds, file.id]);
                          } else {
                            setValue('fileIds', currentIds.filter(id => id !== file.id));
                          }
                        }}
                        className="w-4 h-4 rounded accent-pg-teal"
                      />
                      <span className="flex-1 font-body text-pg-navy">{file.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Input */}
          {mode === 'notes' && (
            <div className="mb-6">
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Lecture Notes *</label>
              <textarea
                {...register('notes')}
                placeholder="Paste your lecture notes here..."
                rows={6}
                className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral resize-none font-body"
              />
              {errors.notes && (
                <p className="text-pg-coral text-sm mt-1 font-body">{errors.notes.message}</p>
              )}
              <p className="text-sm text-pg-text-secondary mt-1 font-body">
                AI will extract key concepts and create flashcards from your notes
              </p>
            </div>
          )}

          {/* Card Count */}
          <div className="mb-6">
            <label className="block text-sm font-body font-medium text-pg-navy mb-2">Number of Cards</label>
            <input
              type="number"
              {...register('cardCount', { valueAsNumber: true })}
              min={5}
              max={15}
              className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral font-body"
            />
            {errors.cardCount ? (
              <p className="text-pg-coral text-sm mt-1 font-body">{errors.cardCount.message}</p>
            ) : (
              <p className="text-sm text-pg-text-secondary mt-1 font-body">Between 5 and 15 cards</p>
            )}
          </div>

          {/* Additional Context */}
          <div className="mb-6">
            <label className="block text-sm font-body font-medium text-pg-navy mb-2">Additional Context (Optional)</label>
            <textarea
              {...register('additionalContext')}
              placeholder="Any specific focus areas or instructions..."
              rows={3}
              className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral resize-none font-body"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t-2 border-pg-navy">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors disabled:opacity-50 font-body"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="btn-gradient disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Create Deck
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    portalContainerRef.current
  );
};
