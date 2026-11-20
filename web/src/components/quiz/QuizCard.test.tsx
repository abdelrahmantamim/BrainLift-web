import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuizCard } from './QuizCard';
import type { Quiz } from '@/types/quiz.types';
// Mock date-fns
vi.mock('date-fns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('date-fns')>()),
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

describe('QuizCard', () => {
  const mockQuiz: Quiz = {
    id: '1',
    title: 'JavaScript Fundamentals',
    description: 'Test your knowledge of JavaScript basics',
    questionCount: 10,
    createdAt: new Date().toISOString(),
    lastAttempt: new Date().toISOString(),
    bestScore: 8,
    attempts: 3,
    difficulty: 'medium',
    category: 'science',
    tags: ['programming', 'javascript'],
    userId: 'user1',
  };

  const mockOnPlay = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnRename = vi.fn();
  const mockOnUpdateTags = vi.fn();

  const defaultProps = {
    quiz: mockQuiz,
    onPlay: mockOnPlay,
    onDelete: mockOnDelete,
    onRename: mockOnRename,
    onUpdateTags: mockOnUpdateTags,
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

  it('renders quiz information correctly', () => {
    render(<QuizCard {...defaultProps} />);

    expect(screen.getByText('JavaScript Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Test your knowledge of JavaScript basics')).toBeInTheDocument();
    // The question count renders as a bare number next to a Hash icon
    // (no "questions" word in the current markup).
    expect(screen.getByText('10')).toBeInTheDocument();
    // Best score renders as "8/10" (no "Best:" prefix) next to a Trophy icon.
    expect(screen.getByText('8/10')).toBeInTheDocument();
    expect(screen.getByText('2 hours ago')).toBeInTheDocument();
  });

  it('displays difficulty badge', () => {
    render(<QuizCard {...defaultProps} />);
    
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('displays tags', () => {
    render(<QuizCard {...defaultProps} />);
    
    expect(screen.getByText('programming')).toBeInTheDocument();
    expect(screen.getByText('javascript')).toBeInTheDocument();
  });

  it('calls onPlay when Start Quiz button is clicked', async () => {
    const user = userEvent.setup();
    render(<QuizCard {...defaultProps} />);
    
    const playButton = screen.getByText('Start Quiz');
    await user.click(playButton);
    
    expect(mockOnPlay).toHaveBeenCalledWith(mockQuiz);
  });

  it('shows action menu when more button is clicked', async () => {
    const user = userEvent.setup();
    render(<QuizCard {...defaultProps} />);
    
    // Hover over the card to make the more button visible
    const card = screen.getByText('JavaScript Fundamentals').closest('.group');
    await user.hover(card!);
    
    // Click the more button
    const moreButton = document.querySelector('.lucide-ellipsis-vertical')?.parentElement;
    await user.click(moreButton!);
    
    // Menu should be visible
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Edit Tags')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls appropriate handlers when menu items are clicked', async () => {
    const user = userEvent.setup();
    render(<QuizCard {...defaultProps} />);
    
    // Open menu
    const card = screen.getByText('JavaScript Fundamentals').closest('.group');
    await user.hover(card!);
    const moreButton = document.querySelector('.lucide-ellipsis-vertical')?.parentElement;
    await user.click(moreButton!);
    
    // Test rename
    await user.click(screen.getByText('Rename'));
    expect(mockOnRename).toHaveBeenCalledWith(mockQuiz);
    
    // Re-open menu for next test
    await user.click(moreButton!);
    
    // Test edit tags
    await user.click(screen.getByText('Edit Tags'));
    expect(mockOnUpdateTags).toHaveBeenCalledWith(mockQuiz);
    
    // Re-open menu
    await user.click(moreButton!);
    
    // Test share: clicking "Share" has no onShare prop in the current
    // component — it opens the internal ShareModal instead.
    await user.click(screen.getByText('Share'));
    expect(screen.getByText('Share JavaScript Fundamentals')).toBeInTheDocument();

    // Re-open menu
    await user.click(moreButton!);
    
    // Test delete
    await user.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalledWith(mockQuiz);
  });

  it('displays correct category icon', () => {
    render(<QuizCard {...defaultProps} />);
    
    // Science category should show the microscope emoji
    expect(screen.getByText('🔬')).toBeInTheDocument();
  });

  it('handles quiz without optional fields', () => {
    const minimalQuiz: Quiz = {
      id: '2',
      title: 'Basic Quiz',
      questionCount: 5,
      createdAt: new Date().toISOString(),
      attempts: 0,
      userId: 'user1',
    };
    
    render(<QuizCard {...defaultProps} quiz={minimalQuiz} />);

    expect(screen.getByText('Basic Quiz')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText('programming')).not.toBeInTheDocument();
  });

  it('closes menu when clicking outside', async () => {
    const user = userEvent.setup();
    render(<QuizCard {...defaultProps} />);
    
    // Open menu
    const card = screen.getByText('JavaScript Fundamentals').closest('.group');
    await user.hover(card!);
    const moreButton = document.querySelector('.lucide-ellipsis-vertical')?.parentElement;
    await user.click(moreButton!);
    
    expect(screen.getByText('Rename')).toBeInTheDocument();
    
    // Click outside (on the overlay)
    const overlay = document.querySelector('.fixed.inset-0');
    await user.click(overlay!);
    
    // Menu should close
    expect(screen.queryByText('Rename')).not.toBeInTheDocument();
  });
});