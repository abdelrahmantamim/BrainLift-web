import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, GripVertical, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { quizService } from '@/services/quiz.service';
import { useQuizStore } from '@/store/quizStore';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface QuestionEntry {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const emptyQuestion = (): QuestionEntry => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
});

export const QuizCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { fetchQuizzes } = useQuizStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [category, setCategory] = useState('general');
  const [questions, setQuestions] = useState<QuestionEntry[]>([emptyQuestion()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addQuestion = () => {
    setQuestions([...questions, emptyQuestion()]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof QuestionEntry, value: string | number | string[]) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    const newOptions = [...updated[qIndex].options];
    newOptions[oIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options: newOptions };
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    const validQuestions = questions.filter(
      q => q.question.trim() && q.options.every(o => o.trim())
    );

    if (validQuestions.length === 0) {
      toast.error('Add at least one complete question with all options filled');
      return;
    }

    setIsSubmitting(true);
    try {
      await quizService.createQuiz({
        title: title.trim(),
        description: description.trim() || undefined,
        questions: validQuestions.map(q => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || undefined,
        })),
        difficulty,
        category,
      });
      toast.success('Quiz created!');
      await fetchQuizzes();
      navigate('/quizzes');
    } catch {
      toast.error('Failed to create quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledCount = questions.filter(
    q => q.question.trim() && q.options.every(o => o.trim())
  ).length;

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="pg-card shadow-clay-coral p-6 mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/quizzes')}
                className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-pg-navy" />
              </button>
              <div>
                <h1 className="text-2xl font-heading font-bold text-pg-coral">
                  Create Quiz
                </h1>
                <p className="text-pg-text-secondary font-body text-sm">Build your own multiple choice quiz</p>
              </div>
            </div>
          </div>

          {/* Quiz Info */}
          <div className="pg-card shadow-clay-teal p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Quiz Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Physics Midterm Review"
                className="input-auth"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-body font-medium text-pg-navy mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="input-auth resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-body font-medium text-pg-navy mb-2">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  className="input-auth"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-body font-medium text-pg-navy mb-2">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-auth"
                >
                  <option value="general">General</option>
                  <option value="science">Science</option>
                  <option value="math">Math</option>
                  <option value="history">History</option>
                  <option value="language">Language</option>
                  <option value="programming">Programming</option>
                </select>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4 mb-6">
            {questions.map((q, qIndex) => {
              const cardColors = ['coral', 'teal', 'yellow', 'lilac'];
              const cardColor = cardColors[qIndex % cardColors.length];
              return (
                <div key={qIndex} className={`pg-card shadow-clay-${cardColor} p-5 group`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-pg-text-secondary font-body">
                      <GripVertical className="w-4 h-4" />
                      <span className="text-sm font-medium">Question {qIndex + 1}</span>
                    </div>
                    {questions.length > 1 && (
                      <button
                        onClick={() => removeQuestion(qIndex)}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-pg-text-secondary hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-pg-text-secondary font-body mb-1">Question</label>
                      <textarea
                        value={q.question}
                        onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                        placeholder="Enter your question..."
                        rows={2}
                        className="input-auth resize-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-pg-text-secondary font-body mb-2">Options (click to mark correct answer)</label>
                      <div className="space-y-2">
                        {q.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuestion(qIndex, 'correctAnswer', oIndex)}
                              className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all border-2",
                                q.correctAnswer === oIndex
                                  ? "bg-green-500 border-green-500 text-white"
                                  : "border-pg-navy hover:border-green-500"
                              )}
                            >
                              {q.correctAnswer === oIndex && <Check className="w-4 h-4" />}
                            </button>
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oIndex)}`}
                              className="input-auth text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-pg-text-secondary font-body mb-1">Explanation (optional)</label>
                      <input
                        type="text"
                        value={q.explanation}
                        onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                        placeholder="Why is this the correct answer?"
                        className="input-auth text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Question Button */}
          <button
            onClick={addQuestion}
            className="w-full p-4 pg-card shadow-clay-lilac hover:bg-pg-cream transition-all duration-200 flex items-center justify-center gap-2 text-pg-text-secondary hover:text-pg-navy font-body mb-8"
          >
            <Plus className="w-5 h-5" />
            Add Question ({questions.length})
          </button>

          {/* Submit */}
          <div className="pg-card shadow-clay-yellow p-6 flex items-center justify-between">
            <p className="text-sm text-pg-text-secondary font-body">
              {filledCount} question{filledCount !== 1 ? 's' : ''} ready
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/quizzes')}
                className="pg-btn pg-btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim() || filledCount === 0}
                className="pg-btn pg-btn-coral disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Quiz'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
