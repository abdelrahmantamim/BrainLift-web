import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Brain, MessageSquare, Copy, CheckCircle, Download, ChevronRight, User, Bot, Flag } from 'lucide-react';
import { sharingService } from '@/services/sharing.service';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ReportContentModal } from '@/components/common/ReportContentModal';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SharedConversation {
  shareId: string;
  title: string;
  description: string;
  contentType: string;
  metadata: {
    conversationTitle?: string;
    messages?: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
  };
  creatorName: string;
  creatorAvatar?: string;
  createdAt: string;
  viewCount: number;
}

export const ShareMessagePage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<SharedConversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    loadShareData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  const loadShareData = async () => {
    if (!shareId) return;
    try {
      setIsLoading(true);
      const response = await sharingService.getSharedContent<SharedConversation>(shareId);
      setData(response);
    } catch {
      toast.error('Failed to load shared conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to import this conversation');
      navigate('/auth/login');
      return;
    }

    if (!data || !shareId) return;

    setIsImporting(true);
    try {
      await api.post('/share/import', { shareId });
      toast.success('Conversation imported! You can continue it in your chats.');
      navigate('/chat');
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { existingContentId?: string } } };
      if (axiosError.response?.status === 409) {
        toast.success('This conversation is already in your chats.');
        navigate('/chat');
      } else {
        toast.error('Failed to import conversation');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conversation Not Found</h1>
          <p className="text-gray-600 mb-6">This conversation may have been removed or the link is invalid.</p>
          <Link to="/" className="text-purple-600 hover:text-purple-700 font-medium">
            Visit BrainLift Homepage
          </Link>
        </div>
      </div>
    );
  }

  const messages = data.metadata?.messages || [];
  const conversationTitle = data.metadata?.conversationTitle || data.title || 'AI Chat';

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
        {/* Conversation Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{conversationTitle}</h1>
              <p className="text-sm text-gray-500">
                Shared by <span className="font-medium">{data.creatorName}</span>
                {' '}&middot;{' '}
                {messages.length} messages
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-purple-600">
                <MessageSquare className="w-5 h-5" />
                <span className="font-medium">Shared Chat</span>
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

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Import & Continue This Chat
              </>
            )}
          </button>
        </div>

        {/* Messages Preview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Conversation Preview</h2>

          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                    : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                  <div className={`rounded-xl p-4 ${
                    msg.role === 'user'
                      ? 'bg-purple-100 text-gray-900'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}>
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Continue This Conversation on BrainLift</h2>
          <p className="mb-6 text-purple-100">
            Import this chat and keep learning with your AI tutor
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-8 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-medium flex items-center justify-center disabled:opacity-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Import & Continue Chat
              </button>
            ) : (
              <>
                <Link
                  to="/auth/register"
                  className="px-8 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition font-medium flex items-center justify-center"
                >
                  Start Learning Free
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Link>
                <Link
                  to="/auth/login"
                  className="px-8 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition font-medium"
                >
                  Already have an account? Sign In
                </Link>
              </>
            )}
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
