import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onAttachFile?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onAttachFile,
  isLoading,
  disabled
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className="border-t-3 border-pg-navy p-4 pb-6 bg-pg-cream/30 sticky bottom-0">
      <div className="flex items-end gap-3 max-w-5xl mx-auto">
        {onAttachFile && (
          <button
            onClick={onAttachFile}
            disabled={isLoading || disabled}
            className="p-3 rounded-xl hover:bg-pg-lilac/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 border-2 border-pg-navy hover:border-pg-lilac bg-pg-surface shadow-clay-lilac cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-5 h-5 text-pg-navy" />
          </button>
        )}

        <div className="flex-1 flex items-end gap-3 bg-pg-surface border-3 border-pg-navy rounded-2xl shadow-clay-yellow p-2">
          <textarea
            ref={textareaRef}
            name="chat-message"
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading || disabled}
            className={cn(
              "flex-1 px-3 py-2 font-body text-pg-text resize-none bg-transparent",
              "min-h-[48px] max-h-[200px]",
              "border-none outline-none shadow-none ring-0",
              "focus:border-none focus:outline-none focus:shadow-none focus:ring-0",
              "placeholder:text-pg-text-secondary",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{ border: 'none', boxShadow: 'none' }}
            rows={1}
          />

          <button
            onClick={handleSend}
            disabled={!message.trim() || isLoading || disabled}
            className={cn(
              "p-3 rounded-xl transition-all duration-200 flex-shrink-0 cursor-pointer",
              "bg-pg-teal hover:bg-pg-coral border-2 border-pg-navy shadow-clay-teal",
              "h-[48px] w-[48px] flex items-center justify-center",
              "disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-clay-coral"
            )}
            title="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" data-testid="loader-icon" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
