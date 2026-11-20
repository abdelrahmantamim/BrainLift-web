import React, { useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { MessageSquare, Menu, X, FileText, FileDown, Loader2 } from 'lucide-react';
import { pdfService } from '@/services/pdf.service';
import { SessionList } from '@/components/chat/SessionList';
import { MessageItem } from '@/components/chat/MessageItem';
import { ChatInput } from '@/components/chat/ChatInput';
import { useChat } from '@/hooks/useChat';
import { cn } from '@/lib/utils';
import { useChatContextStore } from '@/store/chatContextStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export const ChatPage: React.FC = () => {
  const {
    sessions,
    messages,
    selectedSessionId,
    selectedSession,
    // isLoading,
    isSending,
    selectSession,
    createSession,
    sendMessage,
    deleteSession,
  } = useChat();

  const [showMobileSidebar, setShowMobileSidebar] = React.useState(false);
  const { contextFiles, removeFile } = useChatContextStore();
  const user = useAuthStore((s) => s.user);
  const userAvatarUrl = user?.avatarUrl || user?.avatar_url;
  const chatBackground = user?.chat_background_url || user?.chat_background;
  const [prevFileCount, setPrevFileCount] = React.useState(contextFiles.length);

  // Auto-scroll: always follow the latest message/streaming content
  const scrollToBottom = useCallback(() => {
    // Use querySelectorAll to find the visible scroll anchor
    const anchors = document.querySelectorAll('[data-scroll-anchor]');
    anchors.forEach((el) => {
      // Only scroll if the element is visible (not inside a hidden container)
      if (el.checkVisibility?.() ?? el.getBoundingClientRect().height > 0) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }, []);

  // Scroll when messages change, when streaming content updates, or when sending
  useEffect(() => {
    scrollToBottom();
  }, [messages, messages.length, isSending, scrollToBottom]);

  // Also scroll on streaming content changes via the last message's content
  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    if (lastMessage?.metadata?.isStreaming) {
      scrollToBottom();
    }
  }, [lastMessage?.content, lastMessage?.metadata?.isStreaming, scrollToBottom]);

  // Show notification when files are added to context
  useEffect(() => {
    if (contextFiles.length > prevFileCount) {
      const newFiles = contextFiles.length - prevFileCount;
      toast.success(`${newFiles} file${newFiles > 1 ? 's' : ''} added to chat context`, {
        icon: '📎',
        duration: 3000,
      });
    }
    setPrevFileCount(contextFiles.length);
  }, [contextFiles.length, prevFileCount]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    try {
      // Prepare file context in the format expected by backend
      let fileContext = undefined;
      if (contextFiles.length > 0) {
        if (contextFiles.length === 1) {
          fileContext = { id: contextFiles[0].id };
        } else {
          fileContext = {
            type: 'multiple' as const,
            files: contextFiles.map(file => ({ id: file.id, name: file.fileName }))
          };
        }
      }
      // Session is created automatically by the server when no conversationId is provided
      await sendMessage(message, fileContext);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const [isExportingPDF, setIsExportingPDF] = React.useState(false);

  const handleExportChatPDF = async () => {
    if (messages.length === 0) {
      toast.error('No messages to export');
      return;
    }
    setIsExportingPDF(true);
    try {
      const chatTitle = selectedSession?.title || 'Chat';
      const blob = await pdfService.generatePDF({
        content: JSON.stringify({
          title: chatTitle,
          messages: messages
            .filter(m => !m.metadata?.isThinking)
            .map(m => ({ role: m.role, content: m.content })),
        }),
        type: 'conversation',
        title: chatTitle,
      });
      pdfService.downloadPDF(blob, `${chatTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="h-[calc(100vh-11rem)] lg:h-[calc(100vh-7rem)] flex flex-col bg-pg-cream overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden lg:flex w-full h-full gap-4 p-4">
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Sessions Panel */}
          <Panel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full bg-pg-surface border-3 border-pg-navy rounded-2xl shadow-clay-teal overflow-hidden flex flex-col">
              <SessionList
                sessions={sessions}
                selectedSessionId={selectedSessionId || undefined}
                onSelectSession={selectSession}
                onDeleteSession={deleteSession}
                onCreateSession={() => createSession(undefined)}
              />
            </div>
          </Panel>

          {/* Resize Handle */}
          <PanelResizeHandle className="w-2 bg-pg-navy/20 hover:bg-pg-teal rounded-full transition-colors cursor-col-resize" />

          {/* Chat Panel */}
          <Panel defaultSize={80}>
            <div className="h-full bg-pg-surface border-3 border-pg-navy rounded-2xl shadow-clay-coral flex flex-col overflow-hidden">
              {/* Chat Header */}
              <div className="border-b-3 border-pg-navy p-6 bg-pg-cream/30">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-heading font-bold text-pg-navy">
                    {selectedSession?.title || 'New Chat'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-pg-text-secondary font-body">
                      <MessageSquare className="w-4 h-4" />
                      <span>{messages.length} messages</span>
                    </div>
                    {messages.length > 0 && (
                      <button
                        onClick={handleExportChatPDF}
                        disabled={isExportingPDF}
                        className="p-2 rounded-xl hover:bg-pg-coral/10 transition-colors disabled:opacity-50 cursor-pointer border-2 border-pg-navy hover:border-pg-coral"
                        title="Export chat as PDF"
                      >
                        {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin text-pg-coral" /> : <FileDown className="w-4 h-4 text-pg-navy hover:text-pg-coral" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Context Files */}
                {contextFiles.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {contextFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 px-3 py-2 bg-pg-lilac/20 border-2 border-pg-navy rounded-xl text-sm font-body shadow-clay-lilac"
                      >
                        <FileText className="w-4 h-4 text-pg-navy" />
                        <span className="text-pg-text truncate max-w-[200px]" title={file.fileName}>
                          {file.fileName}
                        </span>
                        <button
                          onClick={() => removeFile(file.id)}
                          className="ml-1 p-0.5 hover:bg-pg-coral/20 rounded-full transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3 h-3 text-pg-navy" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto scroll-smooth bg-pg-cream/50"
                style={chatBackground ? {
                  backgroundImage: `linear-gradient(color-mix(in srgb, var(--pg-cream) 90%, transparent), color-mix(in srgb, var(--pg-cream) 90%, transparent)), url(${chatBackground})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : undefined}
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <div className="text-center font-body">
                      <MessageSquare className="w-20 h-20 mx-auto mb-4 text-pg-teal" />
                      <h3 className="text-xl font-heading font-bold text-pg-navy mb-2">How can I help you today?</h3>
                      <p className="text-pg-text-secondary">Ask me anything about your studies!</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-6">
                    {messages.map((message) => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        userAvatarUrl={userAvatarUrl}
                      />
                    ))}
                    <div data-scroll-anchor className="h-4" />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isSending}
              />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex w-full h-full">
        {/* Mobile Sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300",
            "lg:hidden",
            showMobileSidebar ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full bg-pg-surface border-3 border-pg-navy rounded-2xl shadow-clay-teal flex flex-col m-4">
            <div className="flex items-center justify-between p-4 border-b-3 border-pg-navy flex-shrink-0 bg-pg-cream/30">
              <h2 className="text-lg font-heading font-bold text-pg-navy">Conversations</h2>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-2 rounded-lg hover:bg-pg-coral/10 transition-colors cursor-pointer border-2 border-pg-navy"
              >
                <X className="w-5 h-5 text-pg-navy" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SessionList
                sessions={sessions}
                selectedSessionId={selectedSessionId || undefined}
                onSelectSession={(session) => {
                  selectSession(session);
                  setShowMobileSidebar(false);
                }}
                onDeleteSession={deleteSession}
                onCreateSession={() => {
                  createSession(undefined);
                  setShowMobileSidebar(false);
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        {showMobileSidebar && (
          <div
            className="fixed inset-0 bg-pg-navy/50 z-40 lg:hidden"
            onClick={() => setShowMobileSidebar(false)}
          />
        )}

        {/* Mobile Chat */}
        <div className="flex-1 bg-pg-surface border-3 border-pg-navy rounded-2xl shadow-clay-coral flex flex-col overflow-hidden">
          {/* Mobile Header */}
          <div className="border-b-3 border-pg-navy p-4 bg-pg-cream/30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="p-2 rounded-lg hover:bg-pg-teal/10 transition-colors cursor-pointer border-2 border-pg-navy lg:hidden"
              >
                <Menu className="w-5 h-5 text-pg-navy" />
              </button>
              <h2 className="text-lg font-heading font-bold text-pg-navy flex-1">
                {selectedSession?.title || 'AI Chat'}
              </h2>
              {messages.length > 0 && (
                <button
                  onClick={handleExportChatPDF}
                  disabled={isExportingPDF}
                  className="p-2 rounded-lg hover:bg-pg-coral/10 transition-colors disabled:opacity-50 cursor-pointer border-2 border-pg-navy"
                  title="Export chat as PDF"
                >
                  {isExportingPDF ? <Loader2 className="w-4 h-4 animate-spin text-pg-coral" /> : <FileDown className="w-4 h-4 text-pg-navy" />}
                </button>
              )}
            </div>

            {/* Context Files */}
            {contextFiles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {contextFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-pg-lilac/20 border-2 border-pg-navy rounded-xl text-sm font-body shadow-clay-lilac"
                  >
                    <FileText className="w-3 h-3 text-pg-navy" />
                    <span className="text-pg-text truncate max-w-[150px]" title={file.fileName}>
                      {file.fileName}
                    </span>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="ml-1 p-0.5 hover:bg-pg-coral/20 rounded transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3 h-3 text-pg-navy" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Messages */}
          <div
            className="flex-1 overflow-y-auto scroll-smooth bg-pg-cream/50"
            style={chatBackground ? {
              backgroundImage: `linear-gradient(color-mix(in srgb, var(--pg-cream) 90%, transparent), color-mix(in srgb, var(--pg-cream) 90%, transparent)), url(${chatBackground})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } : undefined}
          >
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center font-body">
                  <MessageSquare className="w-16 h-16 mx-auto text-pg-teal mb-4" />
                  <h3 className="text-lg font-heading font-bold text-pg-navy mb-2">How can I help you today?</h3>
                  <p className="text-pg-text-secondary text-sm">Ask me anything!</p>
                </div>
              </div>
            ) : (
              <div className="py-4">
                {messages.map((message) => (
                  <MessageItem key={message.id} message={message} userAvatarUrl={userAvatarUrl} />
                ))}
                <div data-scroll-anchor className="h-4" />
              </div>
            )}
          </div>
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isSending}
          />
        </div>
      </div>
    </div>
  );
};
