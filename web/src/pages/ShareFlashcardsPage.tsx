import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Brain, Layers, Download, ChevronRight, Share2, Copy, CheckCircle, RefreshCw, Flag } from 'lucide-react';
import { flashcardService } from '@/services/flashcard.service';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ReportContentModal } from '@/components/common/ReportContentModal';
import toast from 'react-hot-toast';

interface SharedFlashcardDeck {
  id: string;
  title: string;
  description: string;
  category: string;
  cardCount: number;
  createdBy: {
    username: string;
  };
  cards: Array<{
    id: string;
    front: string;
    back: string;
  }>;
}

export const ShareFlashcardsPage: React.FC = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [deck, setDeck] = useState<SharedFlashcardDeck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    loadDeck();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  const loadDeck = async () => {
    if (!shareId) return;
    
    try {
      setIsLoading(true);
      const response = await flashcardService.getSharedDeck(shareId);
      // Transform DeckWithCards to SharedFlashcardDeck
      const transformedDeck: SharedFlashcardDeck = {
        id: response.deck.id,
        title: response.deck.name,
        description: '', // Default description
        category: 'general', // Default category
        cardCount: response.cards.length,
        createdBy: {
          username: 'Unknown User' // Default username
        },
        cards: response.cards.map((card, index) => ({
          id: `${response.deck.id}_${index}`,
          front: card.question,
          back: card.answer
        }))
      };
      setDeck(transformedDeck);
    } catch {
      toast.error('Failed to load flashcard deck');
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

  const handleNextCard = () => {
    if (deck && currentCardIndex < deck.cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Flashcard Deck Not Found</h1>
          <p className="text-gray-600 mb-6">This deck may have been removed or the link is invalid.</p>
          <Link to="/" className="text-purple-600 hover:text-purple-700 font-medium">
            Visit BrainLift Homepage
          </Link>
        </div>
      </div>
    );
  }

  const currentCard = deck.cards[currentCardIndex];

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
        {/* Deck Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{deck.title}</h1>
              {deck.description && (
                <p className="text-gray-600 mb-4">{deck.description}</p>
              )}
              <p className="text-sm text-gray-500">
                Created by <span className="font-medium">{deck.createdBy.username}</span>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-purple-600">
                <Share2 className="w-5 h-5" />
                <span className="font-medium">Shared Deck</span>
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

          {/* Deck Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-purple-600 font-semibold text-lg">{deck.cardCount}</div>
                  <div className="text-gray-600 text-sm">Cards</div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-blue-600 font-semibold text-lg">{deck.category}</div>
              <div className="text-gray-600 text-sm">Category</div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleDownloadApp}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Study in BrainLift App
          </button>
        </div>

        {/* Flashcard Preview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Preview Cards</h2>
          
          {/* Card Display */}
          <div className="relative h-80 mb-6">
            <div
              className={`absolute inset-0 bg-white rounded-2xl shadow-xl p-8 cursor-pointer transition-all duration-500 ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
              onClick={() => setIsFlipped(!isFlipped)}
              style={{
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front of card */}
              <div
                className="absolute inset-0 p-8 flex items-center justify-center backface-hidden"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="text-center">
                  <p className="text-sm text-purple-600 mb-4">Front</p>
                  <h3 className="text-2xl font-semibold text-gray-900">{currentCard.front}</h3>
                  <p className="text-sm text-gray-500 mt-6">
                    <RefreshCw className="w-4 h-4 inline mr-1" />
                    Tap to flip
                  </p>
                </div>
              </div>
              
              {/* Back of card */}
              <div
                className="absolute inset-0 p-8 flex items-center justify-center backface-hidden"
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
              >
                <div className="text-center">
                  <p className="text-sm text-green-600 mb-4">Back</p>
                  <h3 className="text-xl text-gray-900">{currentCard.back}</h3>
                  <p className="text-sm text-gray-500 mt-6">
                    <RefreshCw className="w-4 h-4 inline mr-1" />
                    Tap to flip
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevCard}
              disabled={currentCardIndex === 0}
              className="px-4 py-2 text-purple-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            
            <div className="text-center">
              <span className="text-gray-600">
                Card {currentCardIndex + 1} of {deck.cards.length}
              </span>
              <div className="flex space-x-1 mt-2 justify-center">
                {deck.cards.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentCardIndex ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <button
              onClick={handleNextCard}
              disabled={currentCardIndex === deck.cards.length - 1}
              className="px-4 py-2 text-purple-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Master These Cards with BrainLift</h2>
          <p className="mb-6 text-purple-100">
            Use spaced repetition, track your progress, and learn faster
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
          </div>
        </div>
      </div>

      {/* Add CSS for 3D card flip */}
      <style>{`
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
      `}</style>

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