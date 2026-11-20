import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, BookOpen, Grid, List, MoreVertical, X } from 'lucide-react';
import { useFlashcardStore } from '@/store/flashcardStore';
import { FlashcardDeckCard } from '@/components/flashcards/FlashcardDeckCard';
import { FlashcardGenerationModal } from '@/components/flashcards/FlashcardGenerationModal';
import type { FlashcardDeck } from '@/types/flashcard.types';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const FlashcardsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { decks, fetchDecks, deleteDeck, renameDeck, importDeck, isLoading } = useFlashcardStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importId, setImportId] = useState('');
  const [modalDefaultMode, setModalDefaultMode] = useState<'topic' | 'files' | 'notes'>('topic');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingDeck, setRenamingDeck] = useState<FlashcardDeck | null>(null);
  const [newDeckName, setNewDeckName] = useState('');
  const [preselectedFileId, setPreselectedFileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState<FlashcardDeck | null>(null);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<FlashcardDeck | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    fetchDecks();

    // Check if navigated from files page with file info
    if (location.state?.fileId) {
      setPreselectedFileId(location.state.fileId);
      setShowGenerateModal(true);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDecks = decks.filter((deck) =>
    (deck.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStudy = (deck: FlashcardDeck) => {
    navigate(`/flashcards/${deck.id}/study`);
  };

  const handleReview = (deck: FlashcardDeck) => {
    navigate(`/flashcards/${deck.id}/review`);
  };

  // const handleTest = (deck: FlashcardDeck) => {
  //   // TODO: Implement test mode
  //   navigate(`/flashcards/${deck.id}/test`);
  // };

  // const handleMatch = (deck: FlashcardDeck) => {
  //   // TODO: Implement match mode
  //   navigate(`/flashcards/${deck.id}/match`);
  // };

  const handleDeckClick = (deck: FlashcardDeck) => {
    if (deck.cardCount === 0) {
      toast.error('This deck has no cards yet.');
      return;
    }
    setSelectedDeck(deck);
    setShowModeSelection(true);
  };

  const handleDelete = (deck: FlashcardDeck) => {
    setDeletingDeck(deck);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (deletingDeck) {
      await deleteDeck(deletingDeck.id || '');
      setShowDeleteConfirmation(false);
      setDeletingDeck(null);
    }
  };

  const handleRename = (deck: FlashcardDeck) => {
    setRenamingDeck(deck);
    setNewDeckName(deck.name || '');
    setShowRenameDialog(true);
  };

  const handleShare = (_deck: FlashcardDeck) => {
    // TODO: Implement share functionality
    toast('Share feature coming soon!');
  };

  const handleImport = async () => {
    if (!importId.trim()) {
      toast.error('Please enter a deck ID');
      return;
    }

    try {
      await importDeck(importId.trim());
      setShowImportDialog(false);
      setImportId('');
    } catch {
      // Error handled in store
    }
  };

  const submitRename = async () => {
    if (!renamingDeck || !newDeckName.trim()) return;

    try {
      await renameDeck(renamingDeck.id || '', newDeckName.trim());
      setShowRenameDialog(false);
      setRenamingDeck(null);
      setNewDeckName('');
    } catch {
      // Error handled in store
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-heading text-pg-navy mb-1">My Flashcards</h1>
                <p className="font-body text-pg-text-secondary">Master any subject with spaced repetition</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImportDialog(true)}
                  className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 flex items-center gap-2 font-body"
                >
                  <Download className="w-5 h-5" />
                  <span className="hidden sm:inline">Import</span>
                </button>

                <button
                  onClick={() => setShowCreateOptions(true)}
                  className="btn-gradient px-4 py-2 font-heading rounded-xl flex items-center gap-2 text-white"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Create</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search and View Toggle */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pg-text-secondary" />
              <input
                type="text"
                placeholder="Search flashcard decks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface focus:outline-none focus:ring-2 focus:ring-pg-teal focus:border-pg-teal transition-all duration-200 font-body"
              />
            </div>

            <div className="flex items-center gap-1 border-2 border-pg-navy rounded-xl bg-pg-surface p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  viewMode === 'grid'
                    ? "bg-pg-teal text-white"
                    : "hover:bg-pg-cream"
                )}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  viewMode === 'list'
                    ? "bg-pg-teal text-white"
                    : "hover:bg-pg-cream"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Deck Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-pg-teal animate-pulse" />
                <p className="font-body text-pg-text-secondary">Loading flashcard decks...</p>
              </div>
            </div>
          ) : filteredDecks.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-pg-teal" />
              <h3 className="text-xl font-heading text-pg-navy mb-2">
                {searchQuery ? 'No decks found' : 'No flashcard decks yet!'}
              </h3>
              <p className="font-body text-pg-text-secondary mb-6">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Upload study materials to create your first deck.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateOptions(true)}
                  className="btn-gradient inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Deck
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDecks.slice(0, visibleCount).map((deck) => (
                  <FlashcardDeckCard
                    key={deck.id}
                    deck={deck}
                    onStudy={handleStudy}
                    onReview={handleReview}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onShare={handleShare}
                    onClick={() => handleDeckClick(deck)}
                  />
                ))}
              </div>
              {filteredDecks.length > visibleCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 12)}
                    className="px-6 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all font-heading text-pg-navy hover:-translate-y-0.5"
                  >
                    Load More ({filteredDecks.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {filteredDecks.slice(0, visibleCount).map((deck) => (
                  <FlashcardDeckCard
                    key={deck.id}
                    deck={deck}
                    onStudy={handleStudy}
                    onReview={handleReview}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onShare={handleShare}
                    onClick={() => handleDeckClick(deck)}
                    viewMode="list"
                  />
                ))}
              </div>
              {filteredDecks.length > visibleCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 12)}
                    className="px-6 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all font-heading text-pg-navy hover:-translate-y-0.5"
                  >
                    Load More ({filteredDecks.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Create Options Modal */}
          {showCreateOptions && !deletingDeck && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal max-w-lg w-full overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-heading text-pg-navy">Create Flashcards</h3>
                    <button
                      onClick={() => setShowCreateOptions(false)}
                      className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setShowCreateOptions(false);
                        setModalDefaultMode('files');
                        setShowGenerateModal(true);
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-pg-coral/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <BookOpen className="w-6 h-6 text-pg-coral" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading text-pg-navy mb-1">From Files</h4>
                          <p className="text-sm font-body text-pg-text-secondary">Generate from your documents</p>
                        </div>
                        <MoreVertical className="w-4 h-4 text-pg-text-secondary" />
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateOptions(false);
                        setModalDefaultMode('topic');
                        setShowGenerateModal(true);
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-pg-lilac/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6 text-pg-lilac" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading text-pg-navy mb-1">From Topic</h4>
                          <p className="text-sm font-body text-pg-text-secondary">Generate from a topic or notes</p>
                        </div>
                        <MoreVertical className="w-4 h-4 text-pg-text-secondary" />
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateOptions(false);
                        navigate('/flashcards/create/manual');
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-pg-teal/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6 text-pg-teal" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading text-pg-navy mb-1">Manual Creation</h4>
                          <p className="text-sm font-body text-pg-text-secondary">Create your own flashcards</p>
                        </div>
                        <MoreVertical className="w-4 h-4 text-pg-text-secondary" />
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateOptions(false);
                        setShowImportDialog(true);
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-pg-yellow/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Download className="w-6 h-6 text-pg-yellow" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading text-pg-navy mb-1">Import by ID</h4>
                          <p className="text-sm font-body text-pg-text-secondary">Import shared flashcards</p>
                        </div>
                        <MoreVertical className="w-4 h-4 text-pg-text-secondary" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection Modal */}
          {showModeSelection && selectedDeck && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-lilac max-w-md w-full overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-heading text-pg-navy">Choose Study Mode</h3>
                    <button
                      onClick={() => {
                        setShowModeSelection(false);
                        setSelectedDeck(null);
                      }}
                      className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="font-body text-pg-text-secondary mb-6">How would you like to study "{selectedDeck.name}"?</p>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        handleReview(selectedDeck);
                        setShowModeSelection(false);
                        setSelectedDeck(null);
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 cursor-pointer text-left"
                    >
                      <h4 className="font-heading text-pg-navy mb-1">Review Mode</h4>
                      <p className="text-sm font-body text-pg-text-secondary">Quick review of all cards</p>
                    </button>

                    <button
                      onClick={() => {
                        handleStudy(selectedDeck);
                        setShowModeSelection(false);
                        setSelectedDeck(null);
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:translate-y-[-2px] transition-all duration-200 cursor-pointer text-left"
                    >
                      <h4 className="font-heading text-pg-navy mb-1">Study Mode</h4>
                      <p className="text-sm font-body text-pg-text-secondary">Learn with spaced repetition</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Deck Modal */}
          <FlashcardGenerationModal
            isOpen={showGenerateModal}
            onClose={() => {
              setShowGenerateModal(false);
              setPreselectedFileId(null);
              setModalDefaultMode('topic');
            }}
            preselectedFileId={preselectedFileId}
            defaultMode={modalDefaultMode}
          />

          {/* Import Dialog */}
          {showImportDialog && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-yellow max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Import Flashcard Deck</h3>
                <p className="font-body text-pg-text-secondary mb-4">
                  Enter the deck ID shared with you to import it to your library
                </p>
                <input
                  type="text"
                  placeholder="Enter deck ID..."
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface focus:outline-none focus:ring-2 focus:ring-pg-teal focus:border-pg-teal mb-4 font-body"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowImportDialog(false);
                      setImportId('');
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    className="btn-gradient"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rename Dialog */}
          {showRenameDialog && renamingDeck && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Rename Deck</h3>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitRename()}
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface focus:outline-none focus:ring-2 focus:ring-pg-teal focus:border-pg-teal mb-4 font-body"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowRenameDialog(false);
                      setRenamingDeck(null);
                      setNewDeckName('');
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitRename}
                    disabled={!newDeckName.trim() || newDeckName === renamingDeck.name}
                    className="btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirmation && deletingDeck && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Delete Deck</h3>
                <p className="font-body text-pg-text-secondary mb-6">
                  Are you sure you want to delete "{deletingDeck.name}"? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setDeletingDeck(null);
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-coral text-white hover:translate-y-[-2px] transition-all duration-200 font-body"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
