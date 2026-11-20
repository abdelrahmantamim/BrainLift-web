import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '@/services/file.service';
import type { UploadedFile } from '@/types/file.types';
import toast from 'react-hot-toast';

export const useFiles = (folderId?: string) => {
  const queryClient = useQueryClient();

  // Fetch files
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['files', folderId],
    queryFn: () => fileService.getFiles(folderId),
  });

  // Fetch folders
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: fileService.getFolders,
  });

  // Upload file
  const uploadFileMutation = useMutation({
    mutationFn: ({ file, folderId, onProgress }: {
      file: File;
      folderId?: string;
      onProgress?: (progress: number) => void;
    }) => fileService.uploadFile(file, folderId, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('File uploaded successfully');
    },
    onError: () => {
      toast.error('Failed to upload file');
    },
  });

  // Delete file
  const deleteFileMutation = useMutation({
    mutationFn: fileService.deleteFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('File deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete file');
    },
  });

  // Download file
  const downloadFile = async (file: UploadedFile) => {
    try {
      const blob = await fileService.downloadFile(file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('File downloaded successfully');
    } catch {
      toast.error('Failed to download file');
    }
  };

  // Create folder
  const createFolderMutation = useMutation({
    mutationFn: fileService.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      toast.success('Folder created successfully');
    },
    onError: () => {
      toast.error('Failed to create folder');
    },
  });

  // Delete folder
  const deleteFolderMutation = useMutation({
    mutationFn: fileService.deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('Folder deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete folder');
    },
  });

  // Rename file
  const renameFileMutation = useMutation({
    mutationFn: ({ fileId, newName }: { fileId: string; newName: string }) => 
      fileService.renameFile(fileId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      toast.success('File renamed successfully');
    },
    onError: () => {
      toast.error('Failed to rename file');
    },
  });

  return {
    files,
    folders,
    isLoading: filesLoading || foldersLoading,
    uploadFile: uploadFileMutation.mutate,
    deleteFile: deleteFileMutation.mutate,
    downloadFile,
    createFolder: createFolderMutation.mutate,
    deleteFolder: deleteFolderMutation.mutate,
    renameFile: renameFileMutation.mutate,
    isUploading: uploadFileMutation.isPending,
  };
};