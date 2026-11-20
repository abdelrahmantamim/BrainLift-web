import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Sparkles, FileText, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { DIFFICULTY_CONFIG } from '@/types/quiz.types';
import { quizService } from '@/services/quiz.service';
import { fileService } from '@/services/file.service';
import { useQuizStore } from '@/store/quizStore';
import toast from 'react-hot-toast';
import { checkAndGate, invalidateCache } from '@/utils/limits';

const quizGenerationSchema = z.object({
  mode: z.enum(['topic', 'files']),
  topic: z.string().optional().transform(v => v === '' ? undefined : v).pipe(z.string().min(3, 'Topic must be at least 3 characters').optional()),
  fileIds: z.array(z.string()).optional(),
  questionCount: z.number().min(5, 'Minimum 5 questions').max(10, 'Maximum 10 questions'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  additionalContext: z.string().optional(),
});

type QuizGenerationForm = z.infer<typeof quizGenerationSchema>;

interface QuizGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFileId?: string | null;
  defaultMode?: 'topic' | 'files';
}

export const QuizGenerationModal: React.FC<QuizGenerationModalProps> = ({
  isOpen,
  onClose,
  preselectedFileId,
  defaultMode,
}) => {
  const [mode, setMode] = useState<'topic' | 'files'>(preselectedFileId ? 'files' : (defaultMode || 'topic'));
  const [files, setFiles] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const fetchQuizzes = useQuizStore((state) => state.fetchQuizzes);
  const portalContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalContainerRef.current = el;
    return () => {
      document.body.removeChild(el);
    };
  }, []);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<QuizGenerationForm>({
    resolver: zodResolver(quizGenerationSchema),
    defaultValues: {
      mode: preselectedFileId ? 'files' : (defaultMode || 'topic'),
      questionCount: 10,
      difficulty: 'medium',
      fileIds: preselectedFileId ? [preselectedFileId] : [],
    },
  });

  // Load files when switching to files mode or when preselected file is provided
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

  const onSubmit = async (data: QuizGenerationForm) => {
    if (!(await checkAndGate('quiz', 'quiz_generation'))) return;

    setIsLoading(true);
    try {
      const params = {
        type: mode,
        topic: mode === 'topic' ? data.topic : undefined,
        fileIds: mode === 'files' ? data.fileIds : undefined,
        questionCount: data.questionCount,
        difficulty: data.difficulty,
        customInstructions: data.additionalContext,
        languagePreference: 'auto-detect-default-english',
      };

      // Generate quiz then save it
      const generatedQuiz = await quizService.generateQuiz(params);
      await quizService.saveQuiz(generatedQuiz);
      invalidateCache();

      toast.success('Quiz generated successfully!');
      setIsLoading(false);
      onClose();
      await fetchQuizzes();
    } catch {
      toast.error('Failed to generate quiz');
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
            <Sparkles className="w-6 h-6 text-pg-indigo" />
            Generate Quiz with AI
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors disabled:opacity-50 text-pg-navy"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6">
          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-heading text-pg-navy mb-3">Generation Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('topic');
                  setValue('mode', 'topic');
                }}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200",
                  mode === 'topic'
                    ? "border-pg-indigo bg-pg-indigo/20"
                    : "border-pg-navy hover:bg-pg-cream"
                )}
              >
                <Sparkles className={cn("w-6 h-6 mx-auto mb-2", mode === 'topic' ? "text-pg-indigo" : "text-pg-navy")} />
                <p className="font-heading text-pg-navy">From Topic</p>
                <p className="text-sm text-pg-text-secondary font-body mt-1">Generate quiz from any topic</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('files');
                  setValue('mode', 'files');
                }}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all duration-200",
                  mode === 'files'
                    ? "border-pg-indigo bg-pg-indigo/20"
                    : "border-pg-navy hover:bg-pg-cream"
                )}
              >
                <FileText className={cn("w-6 h-6 mx-auto mb-2", mode === 'files' ? "text-pg-indigo" : "text-pg-navy")} />
                <p className="font-heading text-pg-navy">From Files</p>
                <p className="text-sm text-pg-text-secondary font-body mt-1">Generate from your documents</p>
              </button>
            </div>
          </div>

          {/* Topic Input */}
          {mode === 'topic' && (
            <div className="mb-6">
              <label className="block text-sm font-heading text-pg-navy mb-2">Topic *</label>
              <input
                {...register('topic')}
                placeholder="e.g., World War II, Photosynthesis, Python Programming"
                className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral font-body text-pg-navy placeholder:text-pg-text-secondary"
              />
              {errors.topic && (
                <p className="text-pg-coral text-sm mt-1 font-body">{errors.topic.message}</p>
              )}
            </div>
          )}

          {/* File Selection */}
          {mode === 'files' && (
            <div className="mb-6">
              <label className="block text-sm font-heading text-pg-navy mb-2">Select Files *</label>
              {loadingFiles ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-pg-indigo" />
                </div>
              ) : files.length === 0 ? (
                <p className="text-pg-text-secondary font-body text-center py-8">No files uploaded yet</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file) => (
                    <label
                      key={file.id}
                      className="flex items-center gap-3 p-3 bg-pg-navy/5 border border-pg-navy rounded-xl hover:bg-pg-navy/10 cursor-pointer transition-colors"
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
                        className="w-4 h-4 rounded"
                      />
                      <span className="flex-1 font-body text-pg-navy">{file.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Question Count */}
          <div className="mb-6">
            <label className="block text-sm font-heading text-pg-navy mb-2">Number of Questions</label>
            <input
              type="number"
              {...register('questionCount', { valueAsNumber: true })}
              min={5}
              max={10}
              className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral font-body text-pg-navy"
            />
            {errors.questionCount ? (
              <p className="text-pg-coral text-sm mt-1 font-body">{errors.questionCount.message}</p>
            ) : (
              <p className="text-sm text-pg-text-secondary font-body mt-1">Between 5 and 10 questions</p>
            )}
          </div>

          {/* Difficulty */}
          <div className="mb-6">
            <label className="block text-sm font-heading text-pg-navy mb-2">Difficulty Level</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(DIFFICULTY_CONFIG) as Array<keyof typeof DIFFICULTY_CONFIG>).map((level) => {
                const config = DIFFICULTY_CONFIG[level];
                return (
                  <label key={level}>
                    <input
                      type="radio"
                      value={level}
                      {...register('difficulty')}
                      className="sr-only"
                    />
                    <div className={cn(
                      "p-3 rounded-xl border-2 cursor-pointer text-center transition-all duration-200",
                      watch('difficulty') === level
                        ? `border-pg-indigo ${config.bgColor}`
                        : "border-pg-navy hover:bg-pg-cream"
                    )}>
                      <span className={cn("font-heading", config.color)}>
                        {config.label}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Additional Context */}
          <div className="mb-6">
            <label className="block text-sm font-heading text-pg-navy mb-2">Additional Context (Optional)</label>
            <textarea
              {...register('additionalContext')}
              placeholder="Any specific instructions or focus areas..."
              rows={3}
              className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-navy rounded-xl focus:outline-none focus:ring-2 focus:ring-pg-coral resize-none font-body text-pg-navy placeholder:text-pg-text-secondary"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t-2 border-pg-navy">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border-2 border-pg-navy rounded-xl hover:bg-pg-cream transition-colors disabled:opacity-50 font-body text-pg-navy"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading}
            className="px-6 py-2 btn-gradient font-heading rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Quiz
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    portalContainerRef.current
  );
};
