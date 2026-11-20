import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionList } from './SessionList';
import type { ChatSession } from '@/types/chat.types';

// Mock date-fns
vi.mock('date-fns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('date-fns')>()),
  formatDistanceToNow: vi.fn(() => '2 hours ago'),
}));

describe('SessionList', () => {
  const mockSessions: ChatSession[] = [
    {
      id: '1',
      title: 'Math Homework Help',
      messageCount: 5,
      message_count: 5,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      title: 'Science Project Discussion',
      messageCount: 12,
      message_count: 12,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      title: 'Untitled Chat', // Untitled chat
      messageCount: 2,
      message_count: 2,
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockOnSelectSession = vi.fn();
  const mockOnDeleteSession = vi.fn();
  const mockOnCreateSession = vi.fn();

  const defaultProps = {
    sessions: mockSessions,
    onSelectSession: mockOnSelectSession,
    onDeleteSession: mockOnDeleteSession,
    onCreateSession: mockOnCreateSession,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders new chat button', () => {
    render(<SessionList {...defaultProps} />);
    
    const newChatButton = screen.getByText('New Chat');
    expect(newChatButton).toBeInTheDocument();
  });

  it('calls onCreateSession when new chat button is clicked', async () => {
    const user = userEvent.setup();
    render(<SessionList {...defaultProps} />);
    
    const newChatButton = screen.getByText('New Chat');
    await user.click(newChatButton);
    
    expect(mockOnCreateSession).toHaveBeenCalled();
  });

  it('renders all sessions', () => {
    render(<SessionList {...defaultProps} />);
    
    expect(screen.getByText('Math Homework Help')).toBeInTheDocument();
    expect(screen.getByText('Science Project Discussion')).toBeInTheDocument();
    expect(screen.getByText('Untitled Chat')).toBeInTheDocument();
  });

  it('displays session metadata correctly', () => {
    render(<SessionList {...defaultProps} />);
    
    // Check message counts
    expect(screen.getByText('5 messages')).toBeInTheDocument();
    expect(screen.getByText('12 messages')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
    
    // Check timestamps (all mocked to return '2 hours ago')
    const timeElements = screen.getAllByText('2 hours ago');
    expect(timeElements).toHaveLength(3);
  });

  it('shows empty state when no sessions', () => {
    render(<SessionList {...defaultProps} sessions={[]} />);
    
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Start a new chat to begin')).toBeInTheDocument();
  });

  it('calls onSelectSession when session is clicked', async () => {
    const user = userEvent.setup();
    render(<SessionList {...defaultProps} />);
    
    const sessionItem = screen.getByText('Math Homework Help').closest('div.group');
    await user.click(sessionItem!);
    
    expect(mockOnSelectSession).toHaveBeenCalledWith(mockSessions[0]);
  });

  it('highlights selected session', () => {
    render(<SessionList {...defaultProps} selectedSessionId="2" />);

    const selectedSession = screen.getByText('Science Project Discussion').closest('div.group');
    expect(selectedSession).toHaveClass('bg-pg-teal/20', 'border-pg-teal', 'shadow-clay-teal');

    const unselectedSession = screen.getByText('Math Homework Help').closest('div.group');
    expect(unselectedSession).not.toHaveClass('bg-pg-teal/20');
  });

  it('shows delete button on hover', async () => {
    const user = userEvent.setup();
    render(<SessionList {...defaultProps} />);
    
    const sessionItem = screen.getByText('Math Homework Help').closest('div.group');
    
    // Delete button should have opacity-0 initially
    const deleteButton = sessionItem!.querySelector('button[title="Delete session"]');
    expect(deleteButton).toHaveClass('opacity-0');
    
    // Hover over session
    await user.hover(sessionItem!);
    
    // Delete button should be visible (opacity-100)
    expect(deleteButton).toHaveClass('group-hover:opacity-100');
  });

  it('calls onDeleteSession after confirming deletion', async () => {
    const user = userEvent.setup();
    render(<SessionList {...defaultProps} />);

    const sessionItem = screen.getByText('Math Homework Help').closest('div.group');
    const deleteButton = sessionItem!.querySelector('button[title="Delete session"]');

    // Clicking the trash icon only opens the confirmation dialog; it does
    // not call onDeleteSession directly.
    await user.click(deleteButton!);
    expect(mockOnDeleteSession).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Chat?')).toBeInTheDocument();

    // Confirming in the dialog calls onDeleteSession with the session id.
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(confirmButton);

    expect(mockOnDeleteSession).toHaveBeenCalledWith('1');
  });

  it('prevents session selection when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<SessionList {...defaultProps} />);

    const sessionItem = screen.getByText('Math Homework Help').closest('div.group');
    const deleteButton = sessionItem!.querySelector('button[title="Delete session"]');

    await user.click(deleteButton!);
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    await user.click(confirmButton);

    expect(mockOnDeleteSession).toHaveBeenCalledWith('1');
    expect(mockOnSelectSession).not.toHaveBeenCalled();
  });

  it('displays untitled chat for sessions without title', () => {
    render(<SessionList {...defaultProps} />);
    
    // The third session has null title
    expect(screen.getByText('Untitled Chat')).toBeInTheDocument();
  });

  it('renders correct icons', () => {
    render(<SessionList {...defaultProps} />);
    
    // Check for message square icons
    const messageSquareIcons = document.querySelectorAll('.lucide-message-square');
    expect(messageSquareIcons.length).toBeGreaterThan(0);
    
    // Check for clock icons
    const clockIcons = document.querySelectorAll('.lucide-clock');
    expect(clockIcons).toHaveLength(3); // One for each session
    
    // Check for trash icons
    const trashIcons = document.querySelectorAll('.lucide-trash-2');
    expect(trashIcons).toHaveLength(3); // One for each session
  });

  it('handles long session titles with truncation', () => {
    const longTitleSession: ChatSession = {
      id: '4',
      title: 'This is a very long session title that should be truncated in the UI to prevent overflow',
      messageCount: 1,
      message_count: 1,
      created_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    render(<SessionList {...defaultProps} sessions={[longTitleSession]} />);
    
    const titleElement = screen.getByText(longTitleSession.title!);
    expect(titleElement).toHaveClass('truncate');
  });

  it('scrolls content when sessions overflow', () => {
    render(<SessionList {...defaultProps} />);
    
    const scrollableContainer = screen.getByText('Math Homework Help').closest('.overflow-y-auto');
    expect(scrollableContainer).toBeInTheDocument();
    expect(scrollableContainer).toHaveClass('flex-1');
  });
});