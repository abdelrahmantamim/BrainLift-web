import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileItem } from './FileItem';
import type { UploadedFile } from '@/types/file.types';

// Mock date-fns
vi.mock('date-fns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('date-fns')>()),
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

describe('FileItem', () => {
  const mockFile: UploadedFile = {
    id: '1',
    fileName: 'test-document.pdf',
    fileType: 'application/pdf',
    fileSize: 1048576, // 1MB
    status: 'completed',
    uploadedAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
  };

  const mockOnView = vi.fn();
  const mockOnDownload = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSelect = vi.fn();

  const defaultProps = {
    file: mockFile,
    onView: mockOnView,
    onDownload: mockOnDownload,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // The dropdown menu renders into a portal targeting #modal-root (see
    // index.html); jsdom doesn't include it, so create it for each test.
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  });

  afterEach(() => {
    document.getElementById('modal-root')?.remove();
  });

  it('renders file information correctly', () => {
    render(<FileItem {...defaultProps} />);

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('shows correct icon based on file type', () => {
    const { rerender } = render(<FileItem {...defaultProps} />);
    
    // PDF file should show FileText icon
    expect(document.querySelector('.lucide-file-text')).toBeInTheDocument();

    // Image file should show FileImage icon
    const imageFile = { ...mockFile, fileType: 'image/jpeg' };
    rerender(<FileItem {...defaultProps} file={imageFile} />);
    expect(document.querySelector('.lucide-file-image')).toBeInTheDocument();

    // Presentation file should show Presentation icon
    const pptFile = { ...mockFile, fileType: 'application/vnd.ms-powerpoint' };
    rerender(<FileItem {...defaultProps} file={pptFile} />);
    expect(document.querySelector('.lucide-presentation')).toBeInTheDocument();

    // Generic file should show File icon
    const genericFile = { ...mockFile, fileType: 'application/octet-stream' };
    rerender(<FileItem {...defaultProps} file={genericFile} />);
    expect(document.querySelector('.lucide-file')).toBeInTheDocument();
  });

  it('shows status icon based on file status', () => {
    // Completed status: grid view hides the status icon entirely (only
    // shown for non-completed statuses), so there's no status testid here.
    const { rerender } = render(<FileItem {...defaultProps} />);
    expect(screen.queryByTestId('status-completed')).not.toBeInTheDocument();

    // Processing status
    const processingFile = { ...mockFile, status: 'processing' as const };
    rerender(<FileItem {...defaultProps} file={processingFile} />);
    expect(screen.getByTestId('status-processing')).toBeInTheDocument();

    // Failed status
    const failedFile = { ...mockFile, status: 'failed' as const };
    rerender(<FileItem {...defaultProps} file={failedFile} />);
    expect(screen.getByTestId('status-failed')).toBeInTheDocument();
  });

  it('shows error message when file has error', () => {
    const fileWithError = {
      ...mockFile,
      status: 'failed' as const,
      error: 'Failed to process file',
    };
    
    render(<FileItem {...defaultProps} file={fileWithError} />);
    expect(screen.getByText('Failed to process file')).toBeInTheDocument();
  });

  it('calls onSelect when the selection checkbox is clicked', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} onSelect={mockOnSelect} />);

    // The checkbox is the clickable div inside the top-left selection
    // overlay; clicking it calls onSelect directly (no modifier keys
    // needed). A plain click on the card itself triggers onView instead.
    const checkbox = document.querySelector('.absolute.top-3.left-3 > div');
    await user.click(checkbox!);

    expect(mockOnSelect).toHaveBeenCalledWith(mockFile);
  });

  it('applies selected styles when isSelected is true', () => {
    render(<FileItem {...defaultProps} isSelected={true} />);

    const fileItem = screen.getByText('test-document.pdf').closest('.group');
    expect(fileItem).toHaveClass('file-card-selected');
  });

  // The current menu renders "Generate Quiz" / "Generate Flashcards" (when
  // their handlers are provided and the file is completed), "Download", and
  // "Delete". There is no "View" menu item: viewing happens via a plain
  // click on the card (see handleClick).
  const getMoreMenuButton = () =>
    document.querySelector('.lucide-ellipsis-vertical')!.closest('button')!;

  it('shows action menu when more button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} onGenerateQuiz={vi.fn()} onGenerateFlashcards={vi.fn()} />);

    // Menu should not be visible initially
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();

    // Click the more button (no hover needed to interact with it in jsdom)
    await user.click(getMoreMenuButton());

    // Menu should be visible
    expect(screen.getByText('Generate Quiz')).toBeInTheDocument();
    expect(screen.getByText('Generate Flashcards')).toBeInTheDocument();
    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onView when the file card is clicked directly (no modifier keys)', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} />);

    const fileItem = screen.getByText('test-document.pdf').closest('.group');
    await user.click(fileItem!);

    expect(mockOnView).toHaveBeenCalledWith(mockFile);
  });

  it('calls onGenerateQuiz when Generate Quiz is clicked', async () => {
    const user = userEvent.setup();
    const mockOnGenerateQuiz = vi.fn();
    render(<FileItem {...defaultProps} onGenerateQuiz={mockOnGenerateQuiz} />);

    await user.click(getMoreMenuButton());

    const quizButton = screen.getByText('Generate Quiz');
    await user.click(quizButton);

    expect(mockOnGenerateQuiz).toHaveBeenCalledWith(mockFile);
    // Menu should close
    expect(screen.queryByText('Generate Quiz')).not.toBeInTheDocument();
  });

  it('calls onDownload when Download is clicked', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} />);

    // Open menu
    await user.click(getMoreMenuButton());

    // Click download
    const downloadButton = screen.getByText('Download');
    await user.click(downloadButton);

    expect(mockOnDownload).toHaveBeenCalledWith(mockFile);
    // Menu should close
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} />);

    // Open menu
    await user.click(getMoreMenuButton());

    // Click delete
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockFile);
    // Menu should close
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} />);

    // Open menu
    await user.click(getMoreMenuButton());

    expect(screen.getByText('Delete')).toBeInTheDocument();

    // Click outside (on the overlay)
    const overlay = document.querySelector('.fixed.inset-0');
    fireEvent.click(overlay!);

    // Menu should close
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('prevents event propagation when clicking menu buttons', async () => {
    const user = userEvent.setup();
    render(<FileItem {...defaultProps} onSelect={mockOnSelect} />);

    // Open menu
    await user.click(getMoreMenuButton());

    // Click delete button
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    // onSelect/onView should not have been called by the menu-item click
    // (event propagation to the card's own onClick is stopped)
    expect(mockOnSelect).not.toHaveBeenCalled();
    expect(mockOnView).not.toHaveBeenCalled();
    expect(mockOnDelete).toHaveBeenCalledWith(mockFile);
  });

  it('displays thumbnail for image files', () => {
    const imageFile = {
      ...mockFile,
      fileType: 'image/jpeg',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
    };
    
    render(<FileItem {...defaultProps} file={imageFile} />);
    
    const thumbnail = screen.getByAltText('test-document.pdf');
    expect(thumbnail).toBeInTheDocument();
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/thumbnail.jpg');
  });

  it('does not display thumbnail for non-image files', () => {
    const pdfFile = {
      ...mockFile,
      thumbnailUrl: 'https://example.com/thumbnail.jpg', // Has thumbnail URL but not an image
    };
    
    render(<FileItem {...defaultProps} file={pdfFile} />);
    
    const thumbnail = screen.queryByAltText('test-document.pdf');
    expect(thumbnail).not.toBeInTheDocument();
  });

  it('applies opacity when file status is failed', () => {
    const failedFile = {
      ...mockFile,
      status: 'failed' as const,
    };
    
    render(<FileItem {...defaultProps} file={failedFile} />);
    
    const fileItem = screen.getByText('test-document.pdf').closest('.group');
    expect(fileItem).toHaveClass('opacity-60');
  });
});