import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, Brain, Grid, List, X, MoreVertical } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { QuizCard } from '@/components/quiz/QuizCard';
import { QuizGenerationModal } from '@/components/quiz/QuizGenerationModal';
import type { Quiz } from '@/types/quiz.types';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const QuizPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { quizzes, fetchQuizzes, deleteQuiz, importQuiz, renameQuiz, updateQuizTags, isLoading } = useQuizStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importId, setImportId] = useState('');
  const [modalDefaultMode, setModalDefaultMode] = useState<'topic' | 'files'>('topic');
  const [preselectedFileId, setPreselectedFileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deletingQuiz, setDeletingQuiz] = useState<Quiz | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renamingQuiz, setRenamingQuiz] = useState<Quiz | null>(null);
  const [newQuizName, setNewQuizName] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [taggingQuiz, setTaggingQuiz] = useState<Quiz | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    fetchQuizzes();

    // Check if navigated from files page with file info
    if (location.state?.fileId) {
      setPreselectedFileId(location.state.fileId);
      setShowGenerateModal(true);
      // Clear the state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    quiz.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handlePlay = (quiz: Quiz) => {
    navigate(`/quiz/${quiz.id}/take`);
  };

  // const handleReview = (quiz: Quiz) => {
  //   navigate(`/quiz/${quiz.id}/review`);
  // };

  const handleQuizClick = (quiz: Quiz) => {
    // Direct navigation to take quiz
    handlePlay(quiz);
  };

  const handleDelete = (quiz: Quiz) => {
    setDeletingQuiz(quiz);
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (deletingQuiz) {
      await deleteQuiz(deletingQuiz.id);
      setShowDeleteConfirmation(false);
      setDeletingQuiz(null);
    }
  };

  const handleRename = (quiz: Quiz) => {
    setRenamingQuiz(quiz);
    setNewQuizName(quiz.title);
    setNewQuizDescription(quiz.description || '');
    setShowRenameDialog(true);
  };

  const submitRename = async () => {
    if (!renamingQuiz || !newQuizName.trim()) return;

    try {
      await renameQuiz(renamingQuiz.id, newQuizName.trim(), newQuizDescription.trim());
      setShowRenameDialog(false);
      setRenamingQuiz(null);
      setNewQuizName('');
      setNewQuizDescription('');
    } catch {
      // Error handled in store
    }
  };

  const handleUpdateTags = (quiz: Quiz) => {
    setTaggingQuiz(quiz);
    setSelectedTags(quiz.tags || []);
    setSelectedCategory(quiz.category || '');
    setSelectedDifficulty(quiz.difficulty || '');
    setShowTagsDialog(true);
  };

  const submitTagsUpdate = async () => {
    if (!taggingQuiz) return;

    try {
      await updateQuizTags(taggingQuiz.id, {
        tags: selectedTags,
        category: selectedCategory,
        difficulty: selectedDifficulty as 'easy' | 'medium' | 'hard'
      });
      setShowTagsDialog(false);
      setTaggingQuiz(null);
    } catch {
      // Error handled in store
    }
  };

  const handleImport = async () => {
    if (!importId.trim()) {
      toast.error('Please enter a quiz ID');
      return;
    }

    try {
      await importQuiz(importId.trim());
      setShowImportDialog(false);
      setImportId('');
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
                <h1 className="text-3xl font-heading text-pg-navy mb-1">My Quizzes</h1>
                <p className="font-body text-pg-text-secondary">Test your knowledge and track your progress</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImportDialog(true)}
                  className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors flex items-center gap-2 font-body text-pg-navy"
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
                placeholder="Search quizzes, tags, or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy placeholder:text-pg-text-secondary focus:outline-none focus:ring-2 focus:ring-pg-indigo transition-all duration-200"
              />
            </div>

            <div className="flex items-center gap-1 border-2 border-pg-navy rounded-xl bg-pg-surface p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  viewMode === 'grid'
                    ? "bg-pg-navy text-white"
                    : "hover:bg-pg-cream text-pg-navy"
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
                    ? "bg-pg-navy text-white"
                    : "hover:bg-pg-cream text-pg-navy"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quiz Grid/List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Brain className="w-16 h-16 mx-auto mb-4 text-pg-indigo animate-pulse" />
                <p className="font-body text-pg-text-secondary">Loading quizzes...</p>
              </div>
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="py-20 text-center">
              <Brain className="w-20 h-20 mx-auto mb-6 text-pg-indigo" />
              <h3 className="text-2xl font-heading text-pg-navy mb-2">
                {searchQuery ? 'No quizzes found' : 'No quizzes yet'}
              </h3>
              <p className="font-body text-pg-text-secondary mb-6 max-w-md mx-auto">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Ready to test your knowledge? Generate your first AI-powered quiz and start learning!'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateOptions(true)}
                  className="btn-gradient px-6 py-3 font-heading rounded-xl inline-flex items-center gap-2 text-white hover:translate-y-[-2px] transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Generate Your First Quiz
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredQuizzes.slice(0, visibleCount).map((quiz) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    onPlay={handlePlay}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onUpdateTags={handleUpdateTags}
                    onClick={() => handleQuizClick(quiz)}
                  />
                ))}
              </div>
              {filteredQuizzes.length > visibleCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 12)}
                    className="px-6 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all font-heading text-pg-navy hover:-translate-y-0.5"
                  >
                    Load More ({filteredQuizzes.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {filteredQuizzes.slice(0, visibleCount).map((quiz) => (
                  <QuizCard
                    key={quiz.id}
                    quiz={quiz}
                    onPlay={handlePlay}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onUpdateTags={handleUpdateTags}
                    onClick={() => handleQuizClick(quiz)}
                    viewMode="list"
                  />
                ))}
              </div>
              {filteredQuizzes.length > visibleCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 12)}
                    className="px-6 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all font-heading text-pg-navy hover:-translate-y-0.5"
                  >
                    Load More ({filteredQuizzes.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Create Options Modal */}
          {showCreateOptions && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal max-w-lg w-full overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-heading text-pg-navy">Create Quiz</h3>
                    <button
                      onClick={() => setShowCreateOptions(false)}
                      className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
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
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all duration-200 cursor-pointer hover:translate-y-[-2px] group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pg-indigo/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Brain className="w-6 h-6 text-pg-indigo" />
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
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all duration-200 cursor-pointer hover:translate-y-[-2px] group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pg-coral/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6 text-pg-coral" />
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
                        navigate('/quiz/create/manual');
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all duration-200 cursor-pointer hover:translate-y-[-2px] group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pg-teal/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-6 h-6 text-pg-teal" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading text-pg-navy mb-1">Manual Creation</h4>
                          <p className="text-sm font-body text-pg-text-secondary">Create your own quiz questions</p>
                        </div>
                        <MoreVertical className="w-4 h-4 text-pg-text-secondary" />
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowCreateOptions(false);
                        setShowImportDialog(true);
                      }}
                      className="w-full p-4 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all duration-200 cursor-pointer hover:translate-y-[-2px] group text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pg-yellow/20 border-2 border-pg-navy flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Download className="w-6 h-6 text-pg-yellow" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-heading text-pg-navy mb-1">Import by ID</h4>
                          <p className="text-sm font-body text-pg-text-secondary">Import shared quiz</p>
                        </div>
                        <MoreVertical className="w-4 h-4 text-pg-text-secondary" />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate Quiz Modal */}
          <QuizGenerationModal
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
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-lilac max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Import Quiz by ID</h3>
                <p className="font-body text-pg-text-secondary mb-4">
                  Enter the quiz ID shared with you to import it to your library
                </p>
                <input
                  type="text"
                  placeholder="Enter quiz ID..."
                  value={importId}
                  onChange={(e) => setImportId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy placeholder:text-pg-text-secondary focus:outline-none focus:ring-2 focus:ring-pg-indigo mb-4"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowImportDialog(false);
                      setImportId('');
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body text-pg-navy"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    className="btn-gradient px-4 py-2 font-heading rounded-xl text-white"
                  >
                    Import
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rename Dialog */}
          {showRenameDialog && renamingQuiz && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-yellow max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Rename Quiz</h3>
                <input
                  type="text"
                  value={newQuizName}
                  onChange={(e) => setNewQuizName(e.target.value)}
                  placeholder="Quiz title"
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy placeholder:text-pg-text-secondary focus:outline-none focus:ring-2 focus:ring-pg-indigo mb-3"
                  autoFocus
                />
                <textarea
                  value={newQuizDescription}
                  onChange={(e) => setNewQuizDescription(e.target.value)}
                  placeholder="Quiz description (optional)"
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy placeholder:text-pg-text-secondary focus:outline-none focus:ring-2 focus:ring-pg-indigo mb-4 resize-none"
                  rows={3}
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowRenameDialog(false);
                      setRenamingQuiz(null);
                      setNewQuizName('');
                      setNewQuizDescription('');
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body text-pg-navy"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitRename}
                    disabled={!newQuizName.trim() || newQuizName === renamingQuiz.title}
                    className="btn-gradient px-4 py-2 font-heading rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tags Dialog */}
          {showTagsDialog && taggingQuiz && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Update Tags & Category</h3>

                <div className="mb-4">
                  <label className="block text-sm font-heading text-pg-navy mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy focus:outline-none focus:ring-2 focus:ring-pg-indigo"
                  >
                    <option value="">Select category</option>
                    <option value="general">General</option>
                    <option value="science">Science</option>
                    <option value="math">Math</option>
                    <option value="history">History</option>
                    <option value="language">Language</option>
                    <option value="programming">Programming</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-heading text-pg-navy mb-2">Difficulty</label>
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy focus:outline-none focus:ring-2 focus:ring-pg-indigo"
                  >
                    <option value="">Select difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-heading text-pg-navy mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={selectedTags.join(', ')}
                    onChange={(e) => setSelectedTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    placeholder="e.g., physics, mechanics, exam"
                    className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface font-body text-pg-navy placeholder:text-pg-text-secondary focus:outline-none focus:ring-2 focus:ring-pg-indigo"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowTagsDialog(false);
                      setTaggingQuiz(null);
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body text-pg-navy"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitTagsUpdate}
                    className="btn-gradient px-4 py-2 font-heading rounded-xl text-white"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirmation && deletingQuiz && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-md w-full p-6">
                <h3 className="text-xl font-heading text-pg-navy mb-4">Delete Quiz</h3>
                <p className="font-body text-pg-text-secondary mb-6">
                  Are you sure you want to delete "{deletingQuiz.title}"? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteConfirmation(false);
                      setDeletingQuiz(null);
                    }}
                    className="px-4 py-2 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-colors font-body text-pg-navy"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 py-2 border-2 border-pg-coral rounded-xl bg-pg-coral text-white font-heading hover:bg-pg-coral/90 transition-colors"
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
