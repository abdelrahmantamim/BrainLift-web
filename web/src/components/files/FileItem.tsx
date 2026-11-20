import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  File,
  FileText,
  FileImage,
  Presentation,
  Trash2,
  MoreVertical,
  AlertCircle,
  CheckCircle,
  Loader2,
  BrainCircuit,
  BookOpen,
  FileCode,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileArchive,
  Check,
  Download
} from 'lucide-react';
import type { UploadedFile } from '@/types/file.types';
import { cn } from '@/lib/utils';
import { safeFormatDistanceToNow } from '@/utils/dateUtils';

interface FileItemProps {
  file: UploadedFile;
  viewMode?: 'grid' | 'list';
  onView: (file: UploadedFile) => void;
  onDownload: (file: UploadedFile) => void;
  onDelete: (file: UploadedFile) => void;
  onSelect?: (file: UploadedFile) => void;
  onGenerateQuiz?: (file: UploadedFile) => void;
  onGenerateFlashcards?: (file: UploadedFile) => void;
  isSelected?: boolean;
}

const getFileIcon = (fileType: string) => {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return FileText;
  if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return FileImage;
  if (type.includes('presentation') || type.includes('powerpoint') || type.includes('ppt')) return Presentation;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xls')) return FileSpreadsheet;
  if (type.includes('document') || type.includes('doc')) return FileText;
  if (type.includes('video') || type.includes('mp4') || type.includes('avi')) return FileVideo;
  if (type.includes('audio') || type.includes('mp3') || type.includes('wav')) return FileAudio;
  if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return FileArchive;
  if (type.includes('code') || type.includes('json') || type.includes('xml')) return FileCode;
  return File;
};

const getStatusIcon = (status: UploadedFile['status']) => {
  switch (status) {
    case 'processing':
      return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" data-testid="status-processing" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" data-testid="status-completed" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-pg-coral" data-testid="status-failed" />;
    default:
      return null;
  }
};

const getFileTypeLabel = (fileType: string): string => {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return 'PDF';
  if (type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return 'IMG';
  if (type.includes('doc') || type.includes('docx')) return 'DOC';
  if (type.includes('ppt') || type.includes('pptx')) return 'PPT';
  if (type.includes('xls') || type.includes('xlsx')) return 'XLS';
  if (type.includes('zip') || type.includes('rar')) return 'ZIP';
  return fileType.split('/').pop()?.toUpperCase() || 'FILE';
};

const getFileTypeColor = (fileType: string): string => {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return 'from-red-500/20 to-red-600/20 text-pg-coral border-red-500/20';
  if (type.includes('image')) return 'from-blue-500/20 to-blue-600/20 text-blue-400 border-blue-500/20';
  if (type.includes('doc')) return 'from-indigo-500/20 to-indigo-600/20 text-indigo-400 border-indigo-500/20';
  if (type.includes('ppt')) return 'from-orange-500/20 to-orange-600/20 text-orange-400 border-orange-500/20';
  if (type.includes('xls')) return 'from-green-500/20 to-green-600/20 text-green-400 border-green-500/20';
  return 'from-gray-500/20 to-gray-600/20 text-pg-text-secondary border-gray-500/20';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const FileItem: React.FC<FileItemProps> = ({
  file,
  viewMode = 'grid',
  onView,
  onDownload,
  onDelete,
  onSelect,
  onGenerateQuiz,
  onGenerateFlashcards,
  isSelected,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const FileIcon = getFileIcon(file.fileType);

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      onSelect?.(file);
    } else if (!showMenu) {
      onView(file);
    }
  };

  useEffect(() => {
    if (showMenu && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right });
    }
  }, [showMenu]);

  const dropdownMenu = showMenu && menuPos ? ReactDOM.createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(false);
        }}
      />
      <div
        className="fixed z-[9999] bg-pg-surface shadow-lg border-2 border-pg-navy rounded-lg overflow-hidden min-w-[180px]"
        style={{ top: menuPos.top, left: menuPos.left - 180 }}
      >
        {onGenerateQuiz && file.status === 'completed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateQuiz(file);
              setShowMenu(false);
            }}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left text-sm text-pg-text"
          >
            <BrainCircuit className="w-4 h-4" />
            Generate Quiz
          </button>
        )}
        {onGenerateFlashcards && file.status === 'completed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerateFlashcards(file);
              setShowMenu(false);
            }}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left text-sm text-pg-text"
          >
            <BookOpen className="w-4 h-4" />
            Generate Flashcards
          </button>
        )}
        {(onGenerateQuiz || onGenerateFlashcards) && file.status === 'completed' && (
          <div className="border-t border-pg-navy/20 my-1" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(file);
            setShowMenu(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left text-sm text-pg-text"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        <div className="border-t border-pg-navy/20 my-1" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(file);
            setShowMenu(false);
          }}
          className="flex items-center gap-2 w-full px-4 py-2 hover:bg-pg-cream transition-colors text-left text-sm text-pg-coral"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </>,
    document.getElementById('modal-root') as HTMLElement
  ) : null;

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          "file-list-item group relative cursor-pointer",
          isSelected && "bg-purple-500/10 border-l-2 border-purple-500",
          file.status === 'failed' && "opacity-60",
          "overflow-hidden"
        )}
        onClick={handleClick}
      >
        {/* Checkbox */}
        <div className="mr-3">
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(file);
            }}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
              isSelected
                ? "bg-purple-500 border-purple-500"
                : "border-gray-500 hover:border-purple-400"
            )}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>

        {/* File info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
            getFileTypeColor(file.fileType)
          )}>
            <FileIcon className="w-5 h-5" />
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0 px-2">
            <p className="font-medium truncate text-pg-text" title={file.fileName}>{file.fileName}</p>
          </div>

          {/* Type */}
          <div className="w-16 text-center">
            <span className="file-type-badge text-xs">
              {getFileTypeLabel(file.fileType)}
            </span>
          </div>

          {/* Size */}
          <div className="w-20 text-right text-meta text-pg-text-secondary">
            {formatFileSize(file.fileSize)}
          </div>

          {/* Modified */}
          <div className="w-32 text-right text-meta text-pg-text-secondary">
            {safeFormatDistanceToNow(file.uploadedAt, { addSuffix: true })}
          </div>

          {/* Status */}
          <div className="w-8">
            {getStatusIcon(file.status)}
          </div>

          {/* Actions */}
          <div>
            <button
              ref={menuBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-lg hover:bg-pg-navy/10 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-pg-text" />
            </button>
            {dropdownMenu}
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={cn(
        "file-card group relative cursor-pointer",
        isSelected && "file-card-selected",
        file.status === 'failed' && "opacity-60"
      )}
      onClick={handleClick}
    >
      {/* Selection checkbox */}
      <div className="absolute top-3 left-3 z-10">
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(file);
          }}
          className={cn(
            "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
            "opacity-0 group-hover:opacity-100",
            isSelected && "opacity-100",
            isSelected
              ? "bg-purple-500 border-purple-500"
              : "bg-black/50 border-white/50 hover:border-purple-400"
          )}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      </div>

      {/* More menu */}
      <div className="absolute top-3 right-3 z-10">
        <button
          ref={menuBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className={cn(
            "p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-all",
            "opacity-0 group-hover:opacity-100"
          )}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {dropdownMenu}
      </div>

      {/* File content */}
      <div className="flex flex-col h-full">
        {/* Icon and type */}
        <div className="flex items-center justify-between mb-3">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br",
            getFileTypeColor(file.fileType)
          )}>
            <FileIcon className="w-6 h-6" />
          </div>
          <span className={cn(
            "file-type-badge text-xs",
            getFileTypeColor(file.fileType).replace('from-', '').replace('to-', '')
          )}>
            {getFileTypeLabel(file.fileType)}
          </span>
        </div>

        {/* Thumbnail for images */}
        {file.thumbnailUrl && file.fileType.includes('image') && (
          <div className="mb-3 -mx-4 -mt-2">
            <img
              src={file.thumbnailUrl}
              alt={file.fileName}
              className="w-full h-32 object-cover"
            />
          </div>
        )}

        {/* File name */}
        <h3 className="font-medium text-sm mb-2 text-truncate text-pg-text" title={file.fileName}>
          {file.fileName}
        </h3>

        {/* Meta info */}
        <div className="mt-auto">
          <div className="flex items-center justify-between text-meta text-pg-text-secondary">
            <span>{formatFileSize(file.fileSize)}</span>
            <span>{safeFormatDistanceToNow(file.uploadedAt, { addSuffix: true })}</span>
          </div>

          {/* Status */}
          {file.status !== 'completed' && (
            <div className="mt-2 flex items-center justify-center">
              {getStatusIcon(file.status)}
            </div>
          )}

          {/* Error message */}
          {file.error && (
            <p className="text-xs text-pg-coral mt-2 text-truncate" title={file.error}>
              {file.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
