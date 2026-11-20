import api from './api';
import type { UploadedFile, FileFolder } from '@/types/file.types';

class FileService {
  async uploadFile(
    file: File,
    folderId?: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('files', file); // Server expects 'files' field
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const response = await api.post<{ 
      message: string;
      files: Array<{
        id: string;
        name: string;
        size: number;
        type: string;
        uploadedAt: string;
        processingStatus?: string;
        processingNote?: string;
      }>;
      warnings?: Array<{ name: string; error: string }>;
    }>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    // Server returns array of files, but we only upload one
    if (response.data.files && response.data.files.length > 0) {
      const uploadedFile = response.data.files[0];
      return {
        id: uploadedFile.id,
        fileName: uploadedFile.name,
        fileType: uploadedFile.type,
        fileSize: uploadedFile.size,
        uploadedAt: uploadedFile.uploadedAt,
        processedAt: uploadedFile.processingStatus === 'completed' ? uploadedFile.uploadedAt : undefined,
        status: uploadedFile.processingStatus === 'completed' ? 'completed' as const : 'processing' as const,
        folderId: folderId,
      };
    }

    throw new Error('No file was uploaded');
  }

  async uploadMultipleFiles(
    files: File[],
    folderId?: string,
    onProgress?: (fileId: string, progress: number) => void
  ): Promise<UploadedFile[]> {
    // The server supports multiple files in a single request
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const response = await api.post<{ 
      message: string;
      files: Array<{
        id: string;
        name: string;
        size: number;
        type: string;
        uploadedAt: string;
        processingStatus?: string;
        processingNote?: string;
      }>;
      warnings?: Array<{ name: string; error: string }>;
    }>('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          // Report progress for all files combined
          files.forEach(file => onProgress(file.name, progress));
        }
      },
    });

    // Map server response to UploadedFile format
    return response.data.files.map(uploadedFile => ({
      id: uploadedFile.id,
      fileName: uploadedFile.name,
      fileType: uploadedFile.type,
      fileSize: uploadedFile.size,
      uploadedAt: uploadedFile.uploadedAt,
      processedAt: uploadedFile.processingStatus === 'completed' ? uploadedFile.uploadedAt : undefined,
      status: uploadedFile.processingStatus === 'completed' ? 'completed' as const : 'processing' as const,
      folderId: folderId,
    }));
  }

  async getFiles(folderId?: string): Promise<UploadedFile[]> {
    const params = folderId ? { folderId } : {};
    const response = await api.get<{ files: unknown[] }>('/files/list', { params });
    
    // Map server format to frontend format
    return (response.data.files || []).map((file: unknown) => {
      const fileData = file as {
        id: string;
        name?: string;
        fileName?: string;
        type?: string;
        fileType?: string;
        size?: number;
        fileSize?: number;
        uploadedAt?: string;
        uploaded_at?: string;
        processedAt?: string;
        processed_at?: string;
        extractedText?: string;
        extracted_text?: string;
        status?: string;
        error?: string;
        folder_id?: string;
        folderId?: string;
        thumbnailUrl?: string;
        thumbnail_url?: string;
      };
      let displayName = fileData.name || fileData.fileName || 'Unnamed File';
      
      // Extract clean filename from various formats
      // Handle patterns like: photo_1752444914_image.jpg, 1752444914-document.pdf, photo_1752365520_photo_1752368703.jpg
      
      // First, check if it's a base64 or hex string (no extension)
      if (displayName.match(/^[a-fA-F0-9]{20,}$/)) {
        const ext = fileData.type?.split('/')[1] || 'file';
        displayName = `Uploaded ${ext}`;
      }
      // Handle photo_ prefix with timestamp
      else if (displayName.startsWith('photo_')) {
        // Remove all photo_ prefixes and timestamps
        displayName = displayName.replace(/photo_\d{10,}_?/g, '');
        
        // If nothing left, try to get the last meaningful part
        if (!displayName || displayName.trim() === '') {
          const parts = (fileData.name || fileData.fileName || '').split('_');
          displayName = parts[parts.length - 1] || 'Photo';
        }
      }
      // Handle timestamp- prefix (e.g., 1752444914-filename.ext)
      else if (displayName.match(/^\d{10,}-/)) {
        displayName = displayName.replace(/^\d{10,}-/, '');
      }
      // Handle timestamp_ prefix  
      else if (displayName.match(/^\d{10,}_/)) {
        displayName = displayName.replace(/^\d{10,}_/, '');
      }
      
      // Clean up any remaining issues
      displayName = displayName
        .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        .replace(/_+/g, '_') // Replace multiple underscores with single
        .trim();
      
      // If we still have nothing meaningful, generate a name from the file type
      if (!displayName || displayName === '' || displayName.match(/^[a-fA-F0-9]+$/)) {
        const typeMap: Record<string, string> = {
          'image/jpeg': 'Image.jpg',
          'image/jpg': 'Image.jpg',
          'image/png': 'Image.png',
          'image/gif': 'Image.gif',
          'application/pdf': 'Document.pdf',
          'text/plain': 'Text.txt',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Document.docx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Spreadsheet.xlsx',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentation.pptx',
        };
        displayName = typeMap[fileData.type || ''] || `File.${fileData.type?.split('/')[1] || 'bin'}`;
      }
      
      return {
        id: fileData.id,
        fileName: displayName,
        fileType: fileData.type || fileData.fileType || 'unknown',
        fileSize: fileData.size || fileData.fileSize || 0,
        uploadedAt: fileData.uploadedAt || fileData.uploaded_at || new Date().toISOString(),
        processedAt: fileData.processedAt || fileData.processed_at,
        extractedText: fileData.extractedText || fileData.extracted_text,
        status: (fileData.status as 'pending' | 'processing' | 'completed' | 'failed') || 'completed',
        error: fileData.error,
        folderId: fileData.folder_id || fileData.folderId,
        thumbnailUrl: fileData.thumbnailUrl || fileData.thumbnail_url,
      };
    });
  }

  async getFile(fileId: string): Promise<UploadedFile> {
    const response = await api.get<UploadedFile>(`/files/${fileId}`);
    return response.data;
  }

  async deleteFile(fileId: string): Promise<void> {
    await api.delete(`/files/${fileId}`);
  }

  async renameFile(fileId: string, newName: string): Promise<UploadedFile> {
    const response = await api.patch<{ file: {
      id: string;
      name?: string;
      type?: string;
      size?: number;
      uploadedAt?: string;
      uploaded_at?: string;
      processedAt?: string;
      processed_at?: string;
      status?: string;
      error?: string;
      folder_id?: string;
      folderId?: string;
    } }>(`/files/${fileId}/rename`, { name: newName });
    // Map the response to UploadedFile format
    const file = response.data.file;
    return {
      id: file.id,
      fileName: file.name || newName,
      fileType: file.type || 'unknown',
      fileSize: file.size || 0,
      uploadedAt: file.uploadedAt || file.uploaded_at || new Date().toISOString(),
      processedAt: file.processedAt || file.processed_at,
      status: (file.status as 'pending' | 'processing' | 'completed' | 'failed') || 'completed',
      error: file.error,
      folderId: file.folder_id || file.folderId,
    };
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await api.get(`/files/${fileId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Folder operations
  async getFolders(): Promise<FileFolder[]> {
    try {
      const response = await api.get<{ folders: FileFolder[] }>('/folders/list');
      return response.data.folders || [];
    } catch {
      console.error('Error fetching folders:');
      return [];
    }
  }

  async createFolder(name: string): Promise<FileFolder> {
    const response = await api.post<{ folder: FileFolder }>('/folders/create', { name });
    return response.data.folder;
  }

  async updateFolder(folderId: string, name: string): Promise<FileFolder> {
    const response = await api.put<FileFolder>(`/folders/${folderId}`, { name });
    return response.data;
  }

  async deleteFolder(folderId: string): Promise<void> {
    await api.delete(`/folders/${folderId}`);
  }
}

export const fileService = new FileService();