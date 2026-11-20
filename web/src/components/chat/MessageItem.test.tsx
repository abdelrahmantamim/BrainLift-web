import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageItem } from './MessageItem';
import type { Message } from '@/types/chat.types';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MessageItem', () => {
  const mockUserMessage: Message = {
    id: '1',
    content: 'Hello, how are you?',
    role: 'user',
    timestamp: new Date().toISOString(),
    sessionId: 'session1',
  };

  const mockAssistantMessage: Message = {
    id: '2',
    content: 'I am doing well, thank you! How can I help you today?',
    role: 'assistant',
    timestamp: new Date().toISOString(),
    sessionId: 'session1',
  };

  it('renders user message correctly', () => {
    render(<MessageItem message={mockUserMessage} />);
    
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.tagName === 'P' && content === 'Hello, how are you?';
    })).toBeInTheDocument();
  });

  it('renders assistant message correctly', () => {
    render(<MessageItem message={mockAssistantMessage} />);
    
    expect(screen.getByText('I am doing well, thank you! How can I help you today?')).toBeInTheDocument();
  });

  it('shows copy button for assistant messages', () => {
    render(<MessageItem message={mockAssistantMessage} />);
    
    const copyButton = screen.getByTitle('Copy message');
    expect(copyButton).toBeInTheDocument();
  });

  it('does not show copy button for user messages', () => {
    render(<MessageItem message={mockUserMessage} />);
    
    const copyButton = screen.queryByTitle('Copy message');
    expect(copyButton).not.toBeInTheDocument();
  });

  it('copies message to clipboard when copy button is clicked', async () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(<MessageItem message={mockAssistantMessage} />);
    
    const copyButton = screen.getByTitle('Copy message');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockAssistantMessage.content);
    });
  });

  it('renders markdown content correctly', () => {
    const markdownMessage: Message = {
      ...mockAssistantMessage,
      content: '# Hello\n\nThis is **bold** text and this is *italic* text.',
    };

    render(<MessageItem message={markdownMessage} />);
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello');
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('italic')).toBeInTheDocument();
  });

  it('renders code blocks with syntax highlighting', () => {
    const codeMessage: Message = {
      ...mockAssistantMessage,
      content: '```javascript\nconst hello = "world";\nconsole.log(hello);\n```',
    };

    render(<MessageItem message={codeMessage} />);
    
    // Check for pre element (code block container)
    const preElement = document.querySelector('pre');
    expect(preElement).toBeInTheDocument();
    
    // Check if code content exists in the DOM
    const codeElement = preElement?.querySelector('code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement?.textContent).toContain('const hello = "world"');
    expect(codeElement?.textContent).toContain('console.log(hello)');
  });

  it('displays timestamp correctly', () => {
    const testDate = new Date('2024-01-01T12:00:00Z');
    const messageWithTime: Message = {
      ...mockUserMessage,
      timestamp: testDate.toISOString(),
    };

    render(<MessageItem message={messageWithTime} />);
    
    const timeString = testDate.toLocaleTimeString();
    expect(screen.getByText(timeString)).toBeInTheDocument();
  });
});