import React, { useState } from 'react';
import {
  Upload,
  FolderOpen,
  Grid,
  List,
  Search,
  Plus,
  File,
  Folder,
  MessageSquare,
  Trash2,
  SortAsc,
  ChevronDown,
  BrainCircuit,
  BookOpen,
  X,
  Move,
  Edit2,
  ChevronLeft
} from 'lucide-react';
import { FileItem } from '@/components/files/FileItem';
import { FileUploadModal } from '@/components/files/FileUploadModal';
import { useFiles } from '@/hooks/useFiles';
import type { UploadedFile } from '@/types/file.types';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useChatContextStore } from '@/store/chatContextStore';
import { useNavigate, useLocation } from 'react-router-dom';

export const FilesPage: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFileOptions, setShowFileOptions] = useState<{file: UploadedFile; options: Array<{icon: React.ElementType; label: string; action: () => void; danger?: boolean}>} | null>(null);
  const [renameModal, setRenameModal] = useState<{file: UploadedFile; newName: string} | null>(null);
  const [showMobileFolders, setShowMobileFolders] = useState(false);

  const { files, folders, isLoading, deleteFile, downloadFile, createFolder, renameFile } = useFiles(selectedFolder);
  const addFilesToChat = useChatContextStore((state) => state.addFiles);
  const navigate = useNavigate();
  const location = useLocation();

  // Filter and sort files
  const processedFiles = React.useMemo(() => {
    let filtered = files;

    // Filter by folder
    if (selectedFolder) {
      filtered = files.filter(file => file.folderId === selectedFolder);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.fileName && file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort files
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.fileName.localeCompare(b.fileName);
          break;
        case 'date':
          comparison = new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
          break;
        case 'size':
          comparison = b.fileSize - a.fileSize;
          break;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return filtered;
  }, [files, searchQuery, sortBy, sortOrder, selectedFolder]);

  const handleFileSelect = (file: UploadedFile) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(file.id)) {
        newSet.delete(file.id);
      } else {
        newSet.add(file.id);
      }
      return newSet;
    });
  };

  const handleFileOptions = (file: UploadedFile) => {
    const options = [
      {
        icon: MessageSquare,
        label: 'Use in Chat',
        action: () => handleUseInChat(file)
      },
      {
        icon: BrainCircuit,
        label: 'Generate Quiz',
        action: () => handleGenerateQuiz(file)
      },
      {
        icon: BookOpen,
        label: 'Generate Flashcards',
        action: () => handleGenerateFlashcards(file)
      },
      {
        icon: Edit2,
        label: 'Rename',
        action: () => handleRenameFile(file)
      },
      {
        icon: Move,
        label: 'Move to Folder',
        action: () => handleMoveToFolder(file)
      },
      {
        icon: Trash2,
        label: 'Delete',
        action: () => deleteFile(file.id),
        danger: true
      }
    ];

    setShowFileOptions({ file, options });
  };

  const handleCreateFolder = () => {
    const name = prompt('Enter folder name:');
    if (name) {
      createFolder(name);
    }
  };

  const handleUseInChat = (file: UploadedFile) => {
    addFilesToChat([file]);
    toast.success(`Added "${file.fileName}" to chat context`);

    // Only navigate to chat if we're not already there
    if (!location.pathname.includes('/chat')) {
      navigate('/chat');
    }
  };

  const handleRenameFile = (file: UploadedFile) => {
    setRenameModal({ file, newName: file.fileName });
  };

  const handleMoveToFolder = (_file: UploadedFile) => {
    // TODO: Implement folder selection modal
    toast('Move to folder feature coming soon', { icon: '📁' });
  };

  const handleGenerateQuiz = (file: UploadedFile) => {
    navigate('/quizzes', { state: { fileId: file.id, fileName: file.fileName } });
  };

  const handleGenerateFlashcards = (file: UploadedFile) => {
    navigate('/flashcards', { state: { fileId: file.id, fileName: file.fileName } });
  };

  const handleBulkAction = (action: 'chat' | 'delete') => {
    if (action === 'chat') {
      const selectedFileObjects = files.filter(f => selectedFiles.has(f.id));
      addFilesToChat(selectedFileObjects);
      toast.success(`Added ${selectedFiles.size} files to chat context`);

      // Only navigate to chat if we're not already there
      if (!location.pathname.includes('/chat')) {
        navigate('/chat');
      }
    } else if (action === 'delete') {
      if (confirm(`Delete ${selectedFiles.size} files?`)) {
        selectedFiles.forEach(fileId => deleteFile(fileId));
        setSelectedFiles(new Set());
      }
    }
  };

  const currentFolder = folders.find(f => f.id === selectedFolder);

  return (
    <div className="h-full flex flex-col p-4 lg:p-0">
      {/* Header */}
      <div className="mb-4 lg:mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedFolder && (
              <button
                onClick={() => setSelectedFolder(undefined)}
                className="p-2 rounded-xl bg-pg-surface border-2 border-pg-navy hover:bg-pg-yellow/20 hover:-translate-y-0.5 transition-all cursor-pointer"
                title="Back to all files"
              >
                <ChevronLeft className="w-5 h-5 text-pg-navy" />
              </button>
            )}
            <h1 className="text-xl lg:text-2xl font-heading font-bold text-pg-navy">
              Files
            </h1>
            {currentFolder && (
              <>
                <span className="text-pg-text-secondary">/</span>
                <span className="text-lg text-pg-text font-body">{currentFolder.name}</span>
              </>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex items-center gap-2 lg:gap-3">
            <button
              onClick={handleCreateFolder}
              className="p-2 rounded-xl bg-pg-surface border-2 border-pg-navy hover:bg-pg-teal/20 hover:-translate-y-0.5 transition-all cursor-pointer"
              title="Create folder"
            >
              <Plus className="w-5 h-5 text-pg-navy" />
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4">
          {/* Left side - Search and filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:gap-3 w-full lg:flex-1">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pg-text-secondary" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body placeholder:text-pg-text-secondary outline-none transition-all"
              />
            </div>

            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-pg-navy bg-pg-surface hover:bg-pg-lilac/20 hover:-translate-y-0.5 transition-all cursor-pointer text-sm font-body text-pg-text"
              >
                <SortAsc className="w-4 h-4" />
                <span>Sort by {sortBy}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showSortMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSortMenu(false)}
                  />
                  <div className="absolute top-full mt-2 left-0 bg-pg-surface border-3 border-pg-navy rounded-xl shadow-clay-teal z-20 overflow-hidden min-w-[200px]">
                    <div className="p-1">
                      <button
                        onClick={() => { setSortBy('name'); setShowSortMenu(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg hover:bg-pg-yellow/20 transition-colors text-sm font-body text-pg-text cursor-pointer",
                          sortBy === 'name' && "bg-pg-yellow/30"
                        )}
                      >
                        Name
                      </button>
                      <button
                        onClick={() => { setSortBy('date'); setShowSortMenu(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg hover:bg-pg-yellow/20 transition-colors text-sm font-body text-pg-text cursor-pointer",
                          sortBy === 'date' && "bg-pg-yellow/30"
                        )}
                      >
                        Date
                      </button>
                      <button
                        onClick={() => { setSortBy('size'); setShowSortMenu(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg hover:bg-pg-yellow/20 transition-colors text-sm font-body text-pg-text cursor-pointer",
                          sortBy === 'size' && "bg-pg-yellow/30"
                        )}
                      >
                        Size
                      </button>
                    </div>
                    <div className="border-t-2 border-pg-navy/20 p-1">
                      <button
                        onClick={() => { setSortOrder('asc'); setShowSortMenu(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg hover:bg-pg-yellow/20 transition-colors text-sm font-body text-pg-text cursor-pointer",
                          sortOrder === 'asc' && "bg-pg-yellow/30"
                        )}
                      >
                        Ascending
                      </button>
                      <button
                        onClick={() => { setSortOrder('desc'); setShowSortMenu(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg hover:bg-pg-yellow/20 transition-colors text-sm font-body text-pg-text cursor-pointer",
                          sortOrder === 'desc' && "bg-pg-yellow/30"
                        )}
                      >
                        Descending
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right side - View mode and bulk actions */}
          <div className="flex items-center gap-2 lg:gap-3 w-full lg:w-auto justify-between lg:justify-end">
            {/* Bulk actions */}
            {selectedFiles.size > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-pg-surface border-2 border-pg-navy rounded-xl shadow-clay-coral">
                <span className="text-sm text-pg-text-secondary font-body">
                  {selectedFiles.size} selected
                </span>
                <button
                  onClick={() => handleBulkAction('chat')}
                  className="px-3 py-1 text-sm hover:bg-pg-teal/20 rounded-lg transition-all cursor-pointer font-body text-pg-text"
                >
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Add to Chat
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 text-sm hover:bg-pg-coral/20 text-pg-coral rounded-lg transition-all cursor-pointer font-body"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedFiles(new Set())}
                  className="px-3 py-1 text-sm hover:bg-pg-navy/10 rounded-lg transition-all cursor-pointer font-body text-pg-text"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-pg-surface border-2 border-pg-navy rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer",
                  viewMode === 'grid'
                    ? "bg-pg-teal text-white"
                    : "text-pg-text-secondary hover:bg-pg-cream"
                )}
                title="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all cursor-pointer",
                  viewMode === 'list'
                    ? "bg-pg-teal text-white"
                    : "text-pg-text-secondary hover:bg-pg-cream"
                )}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-0">
        {/* Sidebar - Folders */}
        <div className="w-full lg:w-64 flex-shrink-0">
          {/* Mobile Folders Toggle */}
          <button
            onClick={() => setShowMobileFolders(!showMobileFolders)}
            className="lg:hidden w-full flex items-center justify-between p-4 border-2 border-pg-navy rounded-xl bg-pg-surface shadow-clay-yellow mb-4 cursor-pointer hover:-translate-y-0.5 transition-all"
          >
            <span className="font-heading font-semibold text-sm text-pg-navy uppercase tracking-wider">Folders</span>
            <ChevronDown className={cn(
              "w-5 h-5 text-pg-navy transition-transform",
              showMobileFolders && "rotate-180"
            )} />
          </button>

          <div className={cn(
            "border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-yellow p-4 overflow-y-auto",
            "lg:block lg:h-auto lg:sticky lg:top-0",
            !showMobileFolders && "hidden"
          )}>
            <h2 className="hidden lg:block font-heading font-bold mb-4 text-sm text-pg-navy uppercase tracking-wider">Folders</h2>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedFolder(undefined)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer hover:-translate-y-0.5 font-body",
                  !selectedFolder
                    ? "bg-pg-teal text-[#2C3E50] font-semibold border-2 border-pg-navy shadow-clay-navy"
                    : "text-pg-text hover:bg-pg-cream border-2 border-transparent"
                )}
              >
                <FolderOpen className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-left">All Files</span>
                <span className="text-xs opacity-70">{files.length}</span>
              </button>

              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer hover:-translate-y-0.5 font-body",
                    selectedFolder === folder.id
                      ? "bg-pg-yellow text-[#2C3E50] font-semibold border-2 border-pg-navy shadow-clay-navy"
                      : "text-pg-text hover:bg-pg-cream border-2 border-transparent"
                  )}
                >
                  <Folder className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <span className="text-xs opacity-70">{folder.fileCount}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Files Grid/List */}
        <div className="flex-1 border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal p-4 lg:p-6 overflow-y-auto">
          {selectedFolder && folders.find(f => f.id === selectedFolder) && processedFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Folder className="w-16 h-16 text-pg-text-secondary mb-4" />
              <h3 className="text-xl font-heading font-bold text-pg-navy mb-2">Empty Folder</h3>
              <p className="text-pg-text-secondary font-body mb-6">
                This folder is empty. Upload files or move existing files here.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer"
              >
                Upload Files
              </button>
            </div>
          )}

          {!selectedFolder || processedFiles.length > 0 ? (
            isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-pg-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-pg-text-secondary font-body">Loading files...</p>
                </div>
              </div>
            ) : processedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <File className="w-16 h-16 text-pg-text-secondary mb-4" />
                <h3 className="text-xl font-heading font-bold text-pg-navy mb-2">No files found</h3>
                <p className="text-pg-text-secondary font-body mb-6">
                  {searchQuery ? 'Try a different search term' : 'Upload files to get started'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-6 py-3 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer"
                  >
                    Upload Files
                  </button>
                )}
              </div>
            ) : (
              <div className={cn(
                viewMode === 'grid' ? "file-grid" : "space-y-2"
              )}>
                  {processedFiles.map(file => (
                  <FileItem
                    key={file.id}
                    file={file}
                    viewMode={viewMode}
                    onView={handleFileOptions}
                    onDownload={downloadFile}
                    onDelete={(file) => deleteFile(file.id)}
                    onSelect={handleFileSelect}
                    onGenerateQuiz={handleGenerateQuiz}
                    onGenerateFlashcards={handleGenerateFlashcards}
                    isSelected={selectedFiles.has(file.id)}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Upload Modal */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          setShowUploadModal(false);
          // Files will be refreshed automatically via react-query
        }}
        folderId={selectedFolder}
      />

      {/* File Options Modal */}
      {showFileOptions && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <h3 className="text-lg font-heading font-bold text-pg-navy truncate" title={showFileOptions.file.fileName}>
                {showFileOptions.file.fileName}
              </h3>
              <button
                onClick={() => setShowFileOptions(null)}
                className="p-1 rounded-lg hover:bg-pg-navy/10 transition-colors flex-shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5 text-pg-navy" />
              </button>
            </div>

            <div className="space-y-2">
              {showFileOptions.options.map((option, index) => {
                const Icon = option.icon;
                return (
                  <button
                    key={index}
                    onClick={() => {
                      option.action();
                      setShowFileOptions(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-body text-left cursor-pointer hover:-translate-y-0.5 border-2",
                      option.danger
                        ? "hover:bg-pg-coral/20 text-pg-coral border-pg-coral/30"
                        : "hover:bg-pg-teal/10 text-pg-text border-pg-navy/20"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-yellow max-w-sm w-full p-6">
            <h3 className="text-lg font-heading font-bold text-pg-navy mb-4">Rename File</h3>
            <input
              type="text"
              value={renameModal.newName}
              onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRenameModal(null)}
                className="flex-1 px-4 py-2 rounded-xl border-2 border-pg-navy bg-pg-surface hover:bg-pg-cream transition-all font-heading font-semibold text-pg-navy cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (renameModal.newName.trim() && renameModal.newName !== renameModal.file.fileName) {
                    renameFile({ fileId: renameModal.file.id, newName: renameModal.newName.trim() });
                  }
                  setRenameModal(null);
                }}
                className="flex-1 px-4 py-2 btn-gradient rounded-xl font-heading font-semibold text-white border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
