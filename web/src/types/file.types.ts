export interface UploadedFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  processedAt?: string;
  extractedText?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  folderId?: string;
  thumbnailUrl?: string;
}

export interface FileFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
}

export interface FileUploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}