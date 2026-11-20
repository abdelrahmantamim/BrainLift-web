import React, { useState } from 'react';
import { Copy, Check, User, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { safeFormatTime } from '@/utils/dateUtils';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Message } from '@/types/chat.types';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ShareModal } from '@/components/common/ShareModal';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

interface MessageItemProps {
  message: Message;
  userAvatarUrl?: string;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, userAvatarUrl }) => {
  const [copied, setCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const isThinking = message.metadata?.isThinking as boolean;
  const isStreaming = message.metadata?.isStreaming as boolean;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const isUser = message.role === 'user';

  return (
    <div className={cn(
      "px-4 sm:px-6 py-4",
      // Desktop: horizontal layout
      "sm:flex sm:gap-4",
      isUser ? "sm:flex-row-reverse" : "sm:flex-row"
    )}>
      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border-3 border-pg-navy mb-2 sm:mb-0",
        isUser
          ? "bg-pg-coral shadow-clay-coral ml-auto sm:ml-0"
          : "bg-pg-surface shadow-clay-teal p-1"
      )}>
        {isUser ? (
          userAvatarUrl ? (
            <img src={userAvatarUrl} alt="You" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          )
        ) : (
          <img src={BrainLiftLogo} alt="BrainLift AI" className="w-full h-full object-contain" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn("sm:flex-1 sm:max-w-[80%]", isUser && "flex flex-col items-end")}>
        <div className={cn(
          "rounded-2xl px-5 py-4 font-body",
          isUser
            ? "bg-pg-coral text-white border-2 border-pg-navy shadow-clay-coral"
            : "bg-pg-surface border-2 border-pg-navy shadow-clay-teal prose prose-slate max-w-none"
        )}>
          {isUser ? (
            <p className="m-0 text-white">{message.content}</p>
          ) : isThinking || (isStreaming && !message.content) ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="animate-bounce inline-block text-pg-teal" style={{ animationDelay: '0ms' }}>●</span>
                <span className="animate-bounce inline-block text-pg-coral" style={{ animationDelay: '150ms' }}>●</span>
                <span className="animate-bounce inline-block text-pg-yellow" style={{ animationDelay: '300ms' }}>●</span>
              </div>
              <span className="text-pg-text-secondary text-sm">Thinking...</span>
            </div>
          ) : isStreaming ? (
            <div>
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
                }}
              >
                {message.content || ''}
              </ReactMarkdown>
              <span className="inline-block w-2 h-4 bg-pg-teal animate-pulse ml-0.5 rounded" />
            </div>
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

        {/* Actions */}
        {!isThinking && !isStreaming && (
        <div className="flex items-center gap-2 mt-2">
          {!isUser && (
            <>
              <button
                onClick={handleCopy}
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

              <button
                onClick={() => setShowShareModal(true)}
                className="p-1.5 rounded-lg hover:bg-pg-coral/20 transition-colors group relative cursor-pointer border-2 border-transparent hover:border-pg-coral"
                title="Share message"
              >
                <Share2 className="w-4 h-4 text-pg-text-secondary group-hover:text-pg-coral" />

                {/* Custom Tooltip */}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-pg-navy text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap font-body">
                  Share message
                </span>
              </button>
            </>
          )}

          <span className="text-xs text-pg-text-secondary font-body">
            {safeFormatTime(message.timestamp)}
          </span>
        </div>
        )}
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        contentType="message"
        contentId={message.sessionId}
        title="AI Response"
      />
    </div>
  );
};
