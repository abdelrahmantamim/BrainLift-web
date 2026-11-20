import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  const mockOnSendMessage = vi.fn();
  const mockOnAttachFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input field and send button', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByTitle('Send message')).toBeInTheDocument();
  });

  it('sends message when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByTitle('Send message');

    await user.type(input, 'Hello world');
    await user.click(sendButton);

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
    expect(input).toHaveValue('');
  });

  it('sends message when Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');

    await user.type(input, 'Hello world');
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world');
    expect(input).toHaveValue('');
  });

  it('does not send message when Shift+Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText('Type your message...');

    await user.type(input, 'Hello world');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockOnSendMessage).not.toHaveBeenCalled();
    // Shift+Enter adds a newline
    expect(input).toHaveValue('Hello world\n');
  });

  it('does not send empty messages', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const sendButton = screen.getByTitle('Send message');
    
    await user.click(sendButton);
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('shows attach file button when onAttachFile is provided', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} onAttachFile={mockOnAttachFile} />);
    
    expect(screen.getByTitle('Attach file')).toBeInTheDocument();
  });

  it('calls onAttachFile when attach button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} onAttachFile={mockOnAttachFile} />);
    
    const attachButton = screen.getByTitle('Attach file');
    await user.click(attachButton);

    expect(mockOnAttachFile).toHaveBeenCalled();
  });

  it('disables input and buttons when isLoading is true', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={true} />);
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeDisabled();
    expect(screen.getByTitle('Send message')).toBeDisabled();
  });

  it('shows loading spinner when isLoading is true', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={true} />);
    
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('auto-resizes textarea as content grows', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...') as HTMLTextAreaElement;
    const initialHeight = textarea.style.height;

    await user.type(textarea, 'Line 1\nLine 2\nLine 3\nLine 4');

    // The height should have changed (exact value depends on implementation)
    expect(textarea.style.height).not.toBe(initialHeight);
  });
});