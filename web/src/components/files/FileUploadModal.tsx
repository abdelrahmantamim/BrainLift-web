import React, { useCallback, useState } from 'react';
import { X, Upload, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileUploadProgress } from '@/types/file.types';
import { fileService } from '@/services/file.service';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { checkAndGate, invalidateCache } from '@/utils/limits';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  folderId?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  folderId,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, FileUploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds 50MB limit`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type not supported: ${file.name}`;
    }
    return null;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFiles = useCallback((newFiles: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    newFiles.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [handleFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };


  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const queryClient = useQueryClient();

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!(await checkAndGate('file_upload', 'file_upload'))) return;

    setIsUploading(true);
    const progressMap: Record<string, FileUploadProgress> = {};

    try {
      await fileService.uploadMultipleFiles(
        files,
        folderId,
        (fileName, progress) => {
          progressMap[fileName] = {
            fileId: fileName,
            fileName,
            progress,
            status: progress === 100 ? 'processing' : 'uploading',
          };
          setUploadProgress({ ...progressMap });
        }
      );

      invalidateCache();
      toast.success(`Successfully uploaded ${files.length} file(s)`);
      // Invalidate files query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['files'] });
      onUploadComplete();
      onClose();
    } catch {
      toast.error('Failed to upload files');
      console.error('Upload error:');
    } finally {
      setIsUploading(false);
      setFiles([]);
      setUploadProgress({});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="pg-card shadow-clay-teal max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-pg-navy/20">
          <h2 className="text-2xl font-semibold text-pg-text">Upload Files</h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-2 rounded-lg hover:bg-pg-navy/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-pg-text" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
              isDragging
                ? "border-purple-500 bg-purple-500/10"
                : "border-pg-navy/20 hover:border-pg-navy/40"
            )}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-pg-text-secondary" />
            <p className="text-lg font-medium mb-2 text-pg-text">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-pg-text-secondary mb-4">
              Supported: PDF, Word, PowerPoint, Text, Images (Max 50MB)
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
              disabled={isUploading}
            />
            <label
              htmlFor="file-input"
              className="inline-block px-6 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg cursor-pointer transition-colors disabled:opacity-50 text-white"
            >
              Choose Files
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-medium mb-3 text-pg-text">Selected Files ({files.length})</h3>
              {files.map((file, index) => {
                const progress = uploadProgress[file.name];
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-pg-navy/5 rounded-lg"
                  >
                    <File className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-pg-text">{file.name}</p>
                      <p className="text-sm text-pg-text-secondary">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {progress && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 text-sm text-pg-text">
                            {progress.status === 'uploading' && (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Uploading... {progress.progress}%</span>
                              </>
                            )}
                            {progress.status === 'processing' && (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Processing...</span>
                              </>
                            )}
                            {progress.status === 'completed' && (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span>Completed</span>
                              </>
                            )}
                            {progress.status === 'failed' && (
                              <>
                                <AlertCircle className="w-4 h-4 text-pg-coral" />
                                <span>Failed</span>
                              </>
                            )}
                          </div>
                          {progress.status === 'uploading' && (
                            <div className="w-full bg-pg-navy/10 rounded-full h-2 mt-1">
                              <div
                                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {!isUploading && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 rounded hover:bg-pg-navy/10 transition-colors"
                      >
                        <X className="w-4 h-4 text-pg-text" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-pg-navy/20">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg hover:bg-pg-navy/10 transition-colors disabled:opacity-50 text-pg-text"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {files.length} File{files.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
