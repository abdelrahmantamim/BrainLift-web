import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileUploadModal } from './FileUploadModal';
import { fileService } from '@/services/file.service';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('@/services/file.service');
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderModal(props: React.ComponentProps<typeof FileUploadModal>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FileUploadModal {...props} />
    </QueryClientProvider>
  );
}

describe('FileUploadModal', () => {
  const mockOnClose = vi.fn();
  const mockOnUploadComplete = vi.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onUploadComplete: mockOnUploadComplete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    renderModal({ ...defaultProps, isOpen: false });
    expect(screen.queryByText('Upload Files')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    renderModal({ ...defaultProps });
    
    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText('Drop files here or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Supported: PDF, Word, PowerPoint, Text, Images (Max 50MB)')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', async () => {
    const user = userEvent.setup();
    renderModal({ ...defaultProps });
    
    const closeButton = screen.getByRole('button', { name: '' });
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('handles file selection via file input', async () => {
    const user = userEvent.setup();
    renderModal({ ...defaultProps });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText('Selected Files (1)')).toBeInTheDocument();
  });

  it('validates file size and shows error for oversized files', async () => {
    const user = userEvent.setup();
    renderModal({ ...defaultProps });
    
    // Validation reads size metadata; avoid allocating a 51MB jsdom File.
    const largeFile = new File(['test'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 51 * 1024 * 1024 });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, largeFile);
    
    expect(toast.error).toHaveBeenCalledWith('File "large.pdf" exceeds 50MB limit');
    expect(screen.queryByText('large.pdf')).not.toBeInTheDocument();
  });

  it.skip('validates file type and shows error for unsupported types', async () => {
    const user = userEvent.setup();
    renderModal({ ...defaultProps });
    
    const unsupportedFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, unsupportedFile);
    
    // Wait for validation to happen
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('File type not supported: test.exe');
    });
    
    expect(screen.queryByText('test.exe')).not.toBeInTheDocument();
  });

  it('handles drag and drop', async () => {
    renderModal({ ...defaultProps });
    
    const dropZone = screen.getByText('Drop files here or click to browse').parentElement!;
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    // Simulate drag over
    fireEvent.dragOver(dropZone, {
      dataTransfer: { files: [] },
    });
    
    // The drop zone should have the dragging styles
    expect(dropZone).toHaveClass('border-purple-500');
    
    // Simulate drop
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
  });

  it('handles multiple file selection', async () => {
    const user = userEvent.setup();
    renderModal({ ...defaultProps });
    
    const files = [
      new File(['content1'], 'test1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'test2.txt', { type: 'text/plain' }),
    ];
    
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    await user.upload(fileInput, files);
    
    expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    expect(screen.getByText('test1.pdf')).toBeInTheDocument();
    expect(screen.getByText('test2.txt')).toBeInTheDocument();
  });

  it('removes file from list when remove button is clicked', async () => {
    const user = userEvent.setup();
    renderModal({ ...defaultProps });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    
    // Find and click the remove button (X)
    const removeButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('.lucide-x'));
    await user.click(removeButtons[removeButtons.length - 1]);
    
    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
  });

  it('uploads files successfully', async () => {
    const user = userEvent.setup();
    const mockUpload = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fileService).uploadMultipleFiles = mockUpload;
    
    renderModal({ ...defaultProps });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    
    const uploadButton = screen.getByText('Upload 1 File');
    await user.click(uploadButton);
    
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        [file],
        undefined,
        expect.any(Function)
      );
      expect(toast.success).toHaveBeenCalledWith('Successfully uploaded 1 file(s)');
      expect(mockOnUploadComplete).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles upload errors', async () => {
    const user = userEvent.setup();
    const mockUpload = vi.fn().mockRejectedValue(new Error('Upload failed'));
    vi.mocked(fileService).uploadMultipleFiles = mockUpload;
    
    renderModal({ ...defaultProps });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    
    const uploadButton = screen.getByText('Upload 1 File');
    await user.click(uploadButton);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to upload files');
      expect(mockOnUploadComplete).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it('shows upload progress', async () => {
    const user = userEvent.setup();
    let progressCallback: ((fileName: string, progress: number) => void) | undefined;
    
    const mockUpload = vi.fn().mockImplementation((_files: File[], _folderId?: string, callback?: (fileName: string, progress: number) => void) => {
      progressCallback = callback;
      return new Promise((resolve) => {
        setTimeout(() => {
          callback?.('test.pdf', 50);
          resolve(undefined);
        }, 100);
      });
    });
    
    vi.mocked(fileService).uploadMultipleFiles = mockUpload;
    
    renderModal({ ...defaultProps });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    
    const uploadButton = screen.getByText('Upload 1 File');
    await user.click(uploadButton);
    
    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });
    
    // Call progress callback
    if (progressCallback) {
      progressCallback('test.pdf', 50);
    }
    
    await waitFor(() => {
      expect(screen.getByText('Uploading... 50%')).toBeInTheDocument();
    });
  });

  it('disables buttons during upload', async () => {
    const user = userEvent.setup();
    const mockUpload = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
    vi.mocked(fileService).uploadMultipleFiles = mockUpload;
    
    renderModal({ ...defaultProps });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    
    const uploadButton = screen.getByText('Upload 1 File');
    await user.click(uploadButton);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDisabled();
      expect(screen.getByRole('button', { name: '' })).toBeDisabled(); // Close button
    });
  });

  it('passes folderId to upload service when provided', async () => {
    const user = userEvent.setup();
    const mockUpload = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fileService).uploadMultipleFiles = mockUpload;
    
    const folderId = 'folder123';
    renderModal({ ...defaultProps, folderId });
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    
    await user.upload(fileInput, file);
    
    const uploadButton = screen.getByText('Upload 1 File');
    await user.click(uploadButton);
    
    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        [file],
        folderId,
        expect.any(Function)
      );
    });
  });
});
