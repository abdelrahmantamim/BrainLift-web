import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Brain, Download, ChevronRight, Share2, Copy, CheckCircle, Flag } from 'lucide-react';
import { quizService } from '@/services/quiz.service';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ReportContentModal } from '@/components/common/ReportContentModal';
import toast from 'react-hot-toast';

interface SharedQuiz {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  timeLimit: number;
  category: string;
  totalQuestions: number;
  createdBy: {
    username: string;
  };
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
  }>;
}

export const ShareQuizPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [quiz, setQuiz] = useState<SharedQuiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showQuestions, setShowQuestions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    loadQuiz();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  const loadQuiz = async () => {
    if (!shareId) return;
    
    try {
      setIsLoading(true);
      const response = await quizService.getSharedQuiz(shareId) as SharedQuiz;
      setQuiz(response);
    } catch {
      toast.error('Failed to load quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadApp = () => {
    // In production, these would be actual app store links
    window.open('https://apps.apple.com/app/brainlift', '_blank');
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Quiz Not Found</h1>
          <p className="text-gray-600 mb-6">This quiz may have been removed or the link is invalid.</p>
          <Link to="/" className="text-purple-600 hover:text-purple-700 font-medium">
            Visit BrainLift Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Brain className="w-8 h-8 text-purple-600" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                BrainLift
              </span>
            </Link>
            <button
              onClick={handleCopyLink}
              className="flex items-center space-x-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Quiz Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
              {quiz.description && (
                <p className="text-gray-600 mb-4">{quiz.description}</p>
              )}
              <p className="text-sm text-gray-500">
                Created by <span className="font-medium">{quiz.createdBy.username}</span>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-purple-600">
                <Share2 className="w-5 h-5" />
                <span className="font-medium">Shared Quiz</span>
              </div>
              <button
                onClick={() => setIsReportOpen(true)}
                aria-label="Report this content"
                title="Report this content"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quiz Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-purple-600 font-semibold text-lg">{quiz.totalQuestions}</div>
              <div className="text-gray-600 text-sm">Questions</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-blue-600 font-semibold text-lg">{quiz.timeLimit || '∞'}</div>
              <div className="text-gray-600 text-sm">Minutes</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-green-600 font-semibold text-lg capitalize">{quiz.difficulty}</div>
              <div className="text-gray-600 text-sm">Difficulty</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-orange-600 font-semibold text-lg">{quiz.category}</div>
              <div className="text-gray-600 text-sm">Category</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => setShowQuestions(!showQuestions)}
              className="flex-1 px-6 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition font-medium"
            >
              {showQuestions ? 'Hide' : 'Preview'} Questions
            </button>
            <button
              onClick={handleDownloadApp}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Open in App
            </button>
          </div>
        </div>

        {/* Questions Preview */}
        {showQuestions && (
          <div className="space-y-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Questions Preview</h2>
            {quiz.questions.map((question, index) => (
              <div key={question.id} className="bg-white rounded-xl shadow-md p-6">
                <div className="mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 mb-2">
                    Question {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">{question.question}</h3>
                </div>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`p-3 rounded-lg border ${
                        option === question.correctAnswer
                          ? 'bg-green-50 border-green-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <span className="font-medium mr-2">{String.fromCharCode(65 + optionIndex)}.</span>
                      {option}
                      {option === question.correctAnswer && (
                        <span className="ml-2 text-green-600 text-sm">(Correct)</span>
                      )}
                    </div>
                  ))}
                </div>
                {question.explanation && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Explanation:</span> {question.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Take This Quiz in BrainLift</h2>
          <p className="mb-6 text-purple-100">
            Track your progress, compete with friends, and unlock achievements
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth/register"
              className="px-8 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-medium flex items-center justify-center"
            >
              Sign Up Free
              <ChevronRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              to="/auth/login"
              className="px-8 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition font-medium"
            >
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </div>

      {shareId && (
        <ReportContentModal
          isOpen={isReportOpen}
          shareId={shareId}
          onClose={() => setIsReportOpen(false)}
        />
      )}
    </div>
  );
};