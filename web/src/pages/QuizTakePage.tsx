import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Brain,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { cn } from '@/lib/utils';
import { DIFFICULTY_CONFIG } from '@/types/quiz.types';
import { useCelebration } from '@/contexts/CelebrationContext';
import { checkCelebrations } from '@/utils/celebrationCheck';

export const QuizTakePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const celebration = useCelebration();
  const {
    currentQuiz,
    currentAnswers,
    currentQuestionIndex,
    quizStartTime,
    isLoading,
    startQuiz,
    answerQuestion,
    nextQuestion,
    previousQuestion,
    submitQuiz,
    resetQuiz,
  } = useQuizStore();

  const [showResult, setShowResult] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const celebrationsFiredRef = useRef(false);
  const [selectedBeforeSubmit, setSelectedBeforeSubmit] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      startQuiz(id);
      setShowFeedback(false);
      setSelectedBeforeSubmit(null);
      celebrationsFiredRef.current = false;
    }

    return () => {
      resetQuiz();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Timer
  useEffect(() => {
    if (quizStartTime && !showResult) {
      const interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - quizStartTime) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [quizStartTime, showResult]);

  // Fire celebrations once when results are shown (level-up / new achievements / perfect score confetti).
  useEffect(() => {
    if (!showResult || celebrationsFiredRef.current) return;
    celebrationsFiredRef.current = true;

    const correct = currentAnswers.filter(a => a.isCorrect).length;
    const total = currentAnswers.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    if (percentage === 100) {
      celebration.showConfetti();
    }
    checkCelebrations(celebration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    await submitQuiz();
    setShowResult(true);
  };

  const calculateScore = () => {
    if (!currentAnswers) return { correct: 0, total: 0, percentage: 0 };

    const correct = currentAnswers.filter(a => a.isCorrect).length;
    const total = currentAnswers.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correct, total, percentage };
  };

  // Update state when question index changes - must be before conditional returns
  useEffect(() => {
    const answer = currentQuiz ? currentAnswers[currentQuestionIndex] : undefined;
    if (answer && answer.selectedOption !== -1) {
      setShowFeedback(true);
      setSelectedBeforeSubmit(answer.selectedOption);
    } else {
      setShowFeedback(false);
      setSelectedBeforeSubmit(null);
    }
  }, [currentQuestionIndex, currentQuiz, currentAnswers]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-pg-coral animate-pulse" />
          <p className="font-body text-pg-text-secondary">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!currentQuiz) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-pg-coral font-body font-semibold mb-4">Quiz not found</p>
          <button
            onClick={() => navigate('/quizzes')}
            className="pg-btn pg-btn-outline"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    const { correct, total, percentage } = calculateScore();
    const difficulty = currentQuiz.difficulty ? DIFFICULTY_CONFIG[currentQuiz.difficulty] : null;

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="pg-card shadow-clay-coral p-8 text-center">
          <h1 className="text-3xl font-heading font-bold text-pg-navy mb-2">Quiz Completed!</h1>
          <p className="font-body text-pg-text-secondary mb-8">{currentQuiz.title}</p>

          <div className="flex justify-center gap-8 mb-8">
            <div>
              <p className="text-4xl font-heading font-bold text-pg-coral">{correct}/{total}</p>
              <p className="text-sm font-body text-pg-text-secondary">Correct Answers</p>
            </div>
            <div>
              <p className="text-4xl font-heading font-bold text-pg-indigo">{percentage}%</p>
              <p className="text-sm font-body text-pg-text-secondary">Score</p>
            </div>
            <div>
              <p className="text-4xl font-heading font-bold text-pg-teal">{formatTime(timeElapsed)}</p>
              <p className="text-sm font-body text-pg-text-secondary">Time Taken</p>
            </div>
          </div>

          {difficulty && (
            <div className="mb-8">
              <span className={cn(
                "px-4 py-2 rounded-full text-sm font-body font-semibold",
                difficulty.bgColor,
                difficulty.color
              )}>
                {difficulty.label} Difficulty
              </span>
            </div>
          )}

          <div className="space-y-3 mb-8 max-h-96 overflow-y-auto">
            {currentQuiz.questions.map((question, index) => {
              const answer = currentAnswers[index];
              const isCorrect = answer?.isCorrect;

              return (
                <div
                  key={question.id}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left",
                    isCorrect
                      ? "border-pg-teal bg-pg-teal/10"
                      : "border-pg-coral bg-pg-coral/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-pg-teal flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-pg-coral flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-body font-semibold text-pg-navy mb-1">
                        {index + 1}. {question.question}
                      </p>
                      {!isCorrect && (
                        <p className="text-sm font-body text-pg-text-secondary">
                          Correct answer: {question.options[question.correctAnswer]}
                        </p>
                      )}
                      {question.explanation && (
                        <p className="text-sm font-body text-pg-text-secondary mt-2">
                          {question.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/quizzes')}
              className="pg-btn pg-btn-outline"
            >
              Back to Quizzes
            </button>
            <button
              onClick={() => {
                setShowResult(false);
                startQuiz(id!);
                setTimeElapsed(0);
                celebrationsFiredRef.current = false;
              }}
              className="pg-btn pg-btn-coral"
            >
              Retake Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = currentQuiz.questions[currentQuestionIndex];
  const currentAnswer = currentAnswers[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;
  // const hasAnswered = showFeedback; // unused
  const isLastQuestion = currentQuestionIndex === currentQuiz.questions.length - 1;

  const handleOptionSelect = (optionIndex: number) => {
    if (!showFeedback) {
      setSelectedBeforeSubmit(optionIndex);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedBeforeSubmit !== null) {
      answerQuestion(currentQuestion.id, selectedBeforeSubmit);
      setShowFeedback(true);
    }
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setShowFeedback(false);
      setSelectedBeforeSubmit(null);
      nextQuestion();
    }
  };

  const handlePreviousQuestion = () => {
    previousQuestion();
    // Check if the previous question was already answered
    const prevIndex = Math.max(0, currentQuestionIndex - 1);
    const prevAnswer = currentAnswers[prevIndex];
    if (prevAnswer && prevAnswer.selectedOption !== -1) {
      setShowFeedback(true);
      setSelectedBeforeSubmit(prevAnswer.selectedOption);
    } else {
      setShowFeedback(false);
      setSelectedBeforeSubmit(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="pg-card shadow-clay-teal p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-heading font-bold text-pg-navy">{currentQuiz.title}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-body text-pg-text-secondary">
              <Clock className="w-5 h-5" />
              <span>{formatTime(timeElapsed)}</span>
            </div>
            <button
              onClick={() => navigate('/quizzes')}
              className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
              title="Exit quiz"
            >
              <X className="w-5 h-5 text-pg-navy" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pg-xp-track">
          <div
            className="pg-xp-fill bg-gradient-to-r from-pg-coral to-pg-indigo transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm font-body text-pg-text-secondary mt-2">
          Question {currentQuestionIndex + 1} of {currentQuiz.questions.length}
        </p>
      </div>

      {/* Question */}
      <div className="pg-card shadow-clay-yellow p-8 mb-6">
        <h2 className="text-xl font-heading font-bold text-pg-navy mb-6">{currentQuestion.question}</h2>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedBeforeSubmit === index || (showFeedback && currentAnswer?.selectedOption === index);
            const isCorrect = index === currentQuestion.correctAnswer;
            const showAsCorrect = showFeedback && isCorrect;
            const showAsIncorrect = showFeedback && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => handleOptionSelect(index)}
                disabled={showFeedback}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all duration-200",
                  showAsCorrect
                    ? "border-pg-teal bg-pg-teal/20"
                    : showAsIncorrect
                    ? "border-pg-coral bg-pg-coral/20"
                    : isSelected
                    ? "border-pg-indigo bg-pg-indigo/20"
                    : "border-pg-navy/20 hover:border-pg-navy/40 hover:bg-pg-cream",
                  showFeedback && "cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    showAsCorrect
                      ? "border-pg-teal bg-pg-teal"
                      : showAsIncorrect
                      ? "border-pg-coral bg-pg-coral"
                      : isSelected
                      ? "border-pg-indigo bg-pg-indigo"
                      : "border-pg-navy/40"
                  )}>
                    {showAsCorrect ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : showAsIncorrect ? (
                      <XCircle className="w-4 h-4 text-white" />
                    ) : isSelected ? (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    ) : null}
                  </div>
                  <span className={cn(
                    "font-body",
                    showAsCorrect && "text-pg-teal font-semibold",
                    showAsIncorrect && "text-pg-coral font-semibold",
                    !showAsCorrect && !showAsIncorrect && "text-pg-navy"
                  )}>{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showFeedback && currentQuestion.explanation && (
          <div className="mt-6 p-4 bg-pg-teal/10 border-2 border-pg-teal rounded-lg">
            <p className="text-sm font-body text-pg-navy">
              <strong className="font-semibold">Explanation:</strong> {currentQuestion.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="pg-btn pg-btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {currentQuiz.questions.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentQuestionIndex
                  ? "w-8 bg-pg-indigo"
                  : currentAnswers[index]?.selectedOption !== -1
                  ? "bg-pg-indigo/50"
                  : "bg-pg-navy/20"
              )}
            />
          ))}
        </div>

        {!showFeedback ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedBeforeSubmit === null}
            className="pg-btn pg-btn-coral disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="pg-btn pg-btn-coral flex items-center gap-2"
          >
            {isLastQuestion ? (
              <>Finish Quiz</>
            ) : (
              <>Next <ChevronRight className="w-5 h-5" /></>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
