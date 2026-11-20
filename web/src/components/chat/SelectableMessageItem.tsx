import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, User, FileDown, Type } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '@/types/chat.types';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { PDFExportButton } from '@/components/common/PDFExportButton';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

interface SelectableMessageItemProps {
  message: Message;
}

export const SelectableMessageItem: React.FC<SelectableMessageItemProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const messageRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (text?: string) => {
    try {
      await navigator.clipboard.writeText(text || message.content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || !messageRef.current) return;

    const text = selection.toString().trim();
    if (text && messageRef.current.contains(selection.anchorNode)) {
      setSelectedText(text);

      // Get selection bounds
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setShowSelectionMenu(true);
    } else {
      setShowSelectionMenu(false);
      setSelectedText('');
    }
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    return () => {
      document.removeEventListener('selectionchange', handleTextSelection);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSelectionMenu && !messageRef.current?.contains(e.target as Node)) {
        setShowSelectionMenu(false);
        setSelectedText('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSelectionMenu]);

  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-4 px-6 py-4", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border-3 border-pg-navy",
        isUser
          ? "bg-pg-coral shadow-clay-coral"
          : "bg-pg-surface shadow-clay-teal p-1"
      )}>
        {isUser ? (
          <User className="w-6 h-6 text-white" />
        ) : (
          <img src={BrainLiftLogo} alt="BrainLift AI" className="w-full h-full object-contain" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("flex-1 max-w-[80%]", isUser && "flex flex-col items-end")}>
        <div
          ref={messageRef}
          className={cn(
            "rounded-2xl px-5 py-4 font-body border-2 border-pg-navy",
            isUser
              ? "bg-pg-coral text-white shadow-clay-coral"
              : "bg-pg-surface shadow-clay-teal prose prose-slate max-w-none"
          )}
        >
          {isUser ? (
            <p className="text-white m-0">{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code(props: { inline?: boolean; className?: string; children?: React.ReactNode }) {
                  const { inline, className, children, ...restProps } = props;
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as {[key: string]: React.CSSProperties}}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        borderRadius: '0.75rem',
                        fontSize: '0.875rem',
                        border: '2px solid #1A2B4A',
                      }}
                      {...restProps}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className="bg-pg-yellow/30 text-pg-navy px-1.5 py-0.5 rounded border border-pg-navy text-sm" {...restProps}>
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-3 last:mb-0 text-pg-text">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 last:mb-0 text-pg-text">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 last:mb-0 text-pg-text">{children}</ol>,
                h1: ({ children }) => <h1 className="text-2xl font-heading font-bold mb-3 text-pg-navy">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-heading font-bold mb-3 text-pg-navy">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-heading font-bold mb-2 text-pg-navy">{children}</h3>,
                strong: ({ children }) => <strong className="text-pg-navy font-bold">{children}</strong>,
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-pg-teal hover:text-pg-coral underline cursor-pointer transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Selection Menu */}
        {showSelectionMenu && (
          <div
            className="fixed z-50 bg-pg-navy border-2 border-pg-teal rounded-xl shadow-clay-teal p-1 flex items-center gap-1"
            style={{
              left: `${menuPosition.x}px`,
              top: `${menuPosition.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <button
              onClick={() => {
                handleCopy(selectedText);
                setShowSelectionMenu(false);
              }}
              className="p-2 hover:bg-pg-navy/10 rounded transition-colors"
              title="Copy selection"
            >
              <Copy className="w-4 h-4 text-white" />
            </button>
            <PDFExportButton
              content={selectedText}
              type="selection"
              title="Selected Text"
              metadata={{
                timestamp: message.timestamp,
                messageId: message.id,
                fullMessage: message.content,
              }}
              filename={`selection-${new Date(message.timestamp).toISOString().split('T')[0]}.pdf`}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <FileDown className="w-4 h-4 text-white" />
            </PDFExportButton>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          {!isUser && (
            <>
              <button
                onClick={() => handleCopy()}
                className="p-1.5 rounded-lg hover:bg-pg-teal/20 transition-colors group relative cursor-pointer border-2 border-transparent hover:border-pg-teal"
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-pg-teal" />
                ) : (
                  <Copy className="w-4 h-4 text-pg-text-secondary group-hover:text-pg-teal" />
                )}

                {/* Custom Tooltip */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-pg-navy text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-body">
                  {copied ? 'Copied!' : 'Copy message'}
                </span>
              </button>

              <PDFExportButton
                content={message.content}
                type="message"
                title="AI Response"
                metadata={{
                  timestamp: message.timestamp,
                  messageId: message.id,
                }}
                filename={`ai-response-${new Date(message.timestamp).toISOString().split('T')[0]}.pdf`}
                variant="ghost"
                size="sm"
                preview={true}
                className="p-1.5 rounded-lg hover:bg-pg-coral/20 transition-colors group relative cursor-pointer border-2 border-transparent hover:border-pg-coral"
              >
                <FileDown className="w-4 h-4 text-pg-text-secondary group-hover:text-pg-coral" />
              </PDFExportButton>

              {selectedText && (
                <button
                  className="p-1.5 rounded-lg bg-pg-lilac/20 hover:bg-pg-lilac/30 transition-colors flex items-center gap-1 border-2 border-pg-lilac"
                  title="Selection active"
                >
                  <Type className="w-4 h-4 text-pg-lilac" />
                  <span className="text-xs text-pg-lilac font-body">Selection</span>
                </button>
              )}
            </>
          )}

          <span className="text-xs text-pg-text-secondary font-body">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};
