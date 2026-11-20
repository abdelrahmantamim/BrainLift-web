import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Brain, Clock, BookOpen, User, ExternalLink, Smartphone, Flag } from 'lucide-react';
import { shareService } from '@/services/share.service';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ReportContentModal } from '@/components/common/ReportContentModal';
import toast from 'react-hot-toast';

interface SharePreviewData {
  id: string;
  type: 'quiz' | 'flashcards';
  title: string;
  sharedBy: {
    username: string;
    avatarUrl?: string;
  };
  itemCount: number;
  difficulty?: string;
  timeLimit?: number;
  category?: string;
  description?: string;
  createdAt: string;
}

export const SharePreviewPage: React.FC = () => {
  const { type, shareId } = useParams<{ type: string; shareId: string }>();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<SharePreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [userCancelled, setUserCancelled] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    loadPreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, shareId]);

  useEffect(() => {
    if (!isLoading && preview && !userCancelled && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !userCancelled) {
      handleRedirect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, isLoading, preview, userCancelled]);

  const loadPreview = async () => {
    if (!shareId || !type) return;
    
    try {
      setIsLoading(true);
      const response = await shareService.getSharePreview(type as 'quiz' | 'flashcards', shareId);
      setPreview(response);
    } catch {
      toast.error('Failed to load shared content');
      // Redirect to landing page after error
      setTimeout(() => navigate('/'), 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const detectDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    const isMobile = isIOS || isAndroid;
    
    return { isMobile, isIOS, isAndroid };
  };

  const handleRedirect = () => {
    if (isRedirecting) return;
    setIsRedirecting(true);

    const { isMobile, isIOS, isAndroid } = detectDevice();
    const deepLink = `brainlift://share/${type}/${shareId}`;
    
    if (isMobile) {
      // Try to open the app
      window.location.href = deepLink;
      
      // Set up fallback to app store
      setTimeout(() => {
        if (document.hasFocus()) {
          // App didn't open, redirect to app store
          if (isIOS) {
            window.location.href = 'https://apps.apple.com/app/brainlift';
          } else if (isAndroid) {
            window.location.href = 'https://play.google.com/store/apps/details?id=com.brainlift.app';
          }
        }
      }, 2500);
    } else {
      // Desktop: redirect to share page
      navigate(`/share/${type}/${shareId}`);
    }
  };

  const handleOpenNow = () => {
    setUserCancelled(true);
    handleRedirect();
  };

  const handleStayHere = () => {
    setUserCancelled(true);
    navigate(`/share/${type}/${shareId}`);
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!preview) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Content Not Found</h1>
          <p className="text-gray-600">This shared content may have been removed or the link is invalid.</p>
        </div>
      </div>
    );
  }

  const progress = ((5 - countdown) / 5) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Brain className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            BrainLift
          </h1>
        </div>

        {/* Preview Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          {/* Shared By */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              {preview.sharedBy.avatarUrl ? (
                <img
                  src={preview.sharedBy.avatarUrl}
                  alt={preview.sharedBy.username}
                  className="w-12 h-12 rounded-full mr-3"
                />
              ) : (
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
              )}
              <div>
                <p className="text-gray-900 font-medium">{preview.sharedBy.username}</p>
                <p className="text-gray-500 text-sm">
                  shared a {preview.type === 'quiz' ? 'Quiz' : 'Flashcard Set'}
                </p>
              </div>
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

          {/* Content Details */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{preview.title}</h2>
            {preview.description && (
              <p className="text-gray-600 mb-4">{preview.description}</p>
            )}
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="flex items-center text-purple-600">
                  <BookOpen className="w-4 h-4 mr-2" />
                  <span className="font-semibold">
                    {preview.itemCount} {preview.type === 'quiz' ? 'Questions' : 'Cards'}
                  </span>
                </div>
              </div>
              
              {preview.timeLimit && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center text-blue-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="font-semibold">{preview.timeLimit} min</span>
                  </div>
                </div>
              )}
              
              {preview.difficulty && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-green-600 text-center">
                    <span className="font-semibold capitalize">{preview.difficulty}</span>
                  </div>
                </div>
              )}
              
              {preview.category && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="text-orange-600 text-center">
                    <span className="font-semibold">{preview.category}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Countdown */}
          {!userCancelled && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Opening in app...</span>
                <span className="text-lg font-bold text-purple-600">{countdown}s</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-purple-600 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleOpenNow}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Open Now
            </button>
            <button
              onClick={handleStayHere}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium flex items-center justify-center"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Web
            </button>
          </div>
        </div>

        {/* Info Text */}
        <p className="text-center text-sm text-gray-500">
          Don't have the app? You'll be redirected to download it.
        </p>
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