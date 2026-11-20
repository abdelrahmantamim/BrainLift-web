import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import type { Message, ChatSession, SendMessageRequest } from '@/types/chat.types';
import toast from 'react-hot-toast';
import { checkAndGate, invalidateCache } from '@/utils/limits';

export const useChat = (useStreaming = true) => {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingMessageRef = useRef<string>('');
  // Local state for pending messages (used when query is disabled for new chats)
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);

  // Fetch all sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: chatService.getSessions,
    retry: 1,
  });

  // Fetch messages for selected session
  const { data: fetchedMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', selectedSessionId],
    queryFn: () => selectedSessionId ? chatService.getMessages(selectedSessionId) : Promise.resolve([]),
    enabled: !!selectedSessionId && !selectedSessionId.startsWith('temp-'),
    staleTime: 30000, // Don't refetch for 30s - prevents overwriting optimistic updates
  });

  // Combine fetched messages with pending messages (for new chats before session ID is assigned)
  const messages = selectedSessionId && !selectedSessionId.startsWith('temp-')
    ? fetchedMessages
    : pendingMessages;

  // Create new session
  const createSessionMutation = useMutation({
    mutationFn: (title?: string) => chatService.createSession(title),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      setSelectedSessionId(newSession.id);
      toast.success('New chat created');
    },
    onError: () => {
      toast.error('Failed to create new chat');
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: (data: SendMessageRequest) => chatService.sendMessage(data),
    onMutate: async (data) => {
      // Optimistic update
      const optimisticMessage: Message = {
        id: `temp-user-${Date.now()}`,
        content: data.message,
        role: 'user',
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || selectedSessionId || '',
      };
      
      // Add thinking message for AI
      const thinkingMessage: Message = {
        id: `temp-ai-thinking-${Date.now()}`,
        content: '...',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sessionId: data.sessionId || selectedSessionId || '',
        metadata: { isThinking: true },
      };

      queryClient.setQueryData<Message[]>(
        ['chat-messages', selectedSessionId],
        (old = []) => [...old, optimisticMessage, thinkingMessage]
      );

      return { optimisticMessage, thinkingMessage };
    },
    onSuccess: (response, _variables, context) => {
      const { message, conversationId } = response;
      
      // If we got a real conversation ID and were using a temp ID or no ID, update it
      if ((selectedSessionId?.startsWith('temp-') || !selectedSessionId) && conversationId) {
        // Update the session ID
        setSelectedSessionId(conversationId);
        
        // Move messages to the new conversation ID
        const currentMessages = queryClient.getQueryData<Message[]>(['chat-messages', selectedSessionId]) || [];
        // Filter out thinking and optimistic messages
        const filtered = currentMessages.filter(m => 
          m.id !== context?.optimisticMessage.id && 
          m.id !== context?.thinkingMessage.id
        );
        // Add the user message with the real conversation ID and the AI response
        const userMessage: Message = {
          ...context!.optimisticMessage,
          sessionId: conversationId,
          id: `user-${Date.now()}`,
        };
        queryClient.setQueryData<Message[]>(
          ['chat-messages', conversationId],
          [...filtered, userMessage, message]
        );
        
        // Clear old temp messages if they exist
        if (selectedSessionId) {
          queryClient.removeQueries({ queryKey: ['chat-messages', selectedSessionId] });
        }
        
        // For new conversations, refresh sessions after a delay to get the generated title
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
        }, 2000);
      } else {
        // Replace optimistic messages with real response
        queryClient.setQueryData<Message[]>(
          ['chat-messages', selectedSessionId],
          (old = []) => {
            // Remove thinking message and keep user message
            const filtered = old.filter(m => 
              m.id !== context?.thinkingMessage.id && 
              m.id !== context?.optimisticMessage.id
            );
            const userMessage = old.find(m => m.id === context?.optimisticMessage.id);
            if (userMessage) {
              return [...filtered, { ...userMessage, id: `user-${Date.now()}` }, message];
            }
            return [...filtered, message];
          }
        );
      }
      
      // Invalidate sessions to update message count
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
    onError: (_error, _variables, context) => {
      // Remove optimistic messages on error
      queryClient.setQueryData<Message[]>(
        ['chat-messages', selectedSessionId],
        (old = []) => old.filter(m => 
          m.id !== context?.optimisticMessage.id && 
          m.id !== context?.thinkingMessage.id
        )
      );
      toast.error('Failed to send message');
    },
  });

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: chatService.deleteSession,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
      if (selectedSessionId === deletedId) {
        setSelectedSessionId(null);
      }
      toast.success('Chat deleted');
    },
    onError: () => {
      toast.error('Failed to delete chat');
    },
  });

  const selectSession = useCallback((session: ChatSession) => {
    setSelectedSessionId(session.id);
  }, []);

  const sendMessageStreaming = useCallback(async (message: string, fileContext?: { id: string } | { type: 'multiple'; files: { id: string; name: string }[] }) => {
    const currentSessionId = selectedSessionId;
    setIsStreaming(true);
    streamingMessageRef.current = '';

    // Add optimistic user message
    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      content: message,
      role: 'user',
      timestamp: new Date().toISOString(),
      sessionId: currentSessionId || '',
    };

    // Add placeholder for streaming AI response
    const streamingMessage: Message = {
      id: `temp-ai-streaming-${Date.now()}`,
      content: '',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      sessionId: currentSessionId || '',
      metadata: { isStreaming: true },
    };

    // For new chats (no sessionId), use local state; for existing chats, use query cache
    if (!currentSessionId || currentSessionId.startsWith('temp-')) {
      setPendingMessages(prev => [...prev, userMessage, streamingMessage]);
    } else {
      queryClient.setQueryData<Message[]>(
        ['chat-messages', currentSessionId],
        (old = []) => [...old, userMessage, streamingMessage]
      );
    }

    try {
      await chatService.sendMessageStream(
        {
          message,
          sessionId: currentSessionId || undefined,
          fileContext,
        },
        // onChunk - update the streaming message content
        (chunk) => {
          streamingMessageRef.current += chunk;

          // Update the correct state based on whether we have a session ID
          if (!currentSessionId || currentSessionId.startsWith('temp-')) {
            setPendingMessages(prev => prev.map(msg => {
              if (msg.metadata?.isStreaming) {
                return { ...msg, content: streamingMessageRef.current };
              }
              return msg;
            }));
          } else {
            queryClient.setQueryData<Message[]>(
              ['chat-messages', currentSessionId],
              (old = []) => old.map(msg => {
                if (msg.metadata?.isStreaming) {
                  return { ...msg, content: streamingMessageRef.current };
                }
                return msg;
              })
            );
          }
        },
        // onDone - finalize the message
        (fullContent, conversationId) => {
          setIsStreaming(false);
          streamingMessageRef.current = '';

          // Replace streaming message with final message
          const finalMessage: Message = {
            id: `msg-${Date.now()}`,
            content: fullContent,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            sessionId: conversationId || currentSessionId || '',
          };

          const targetSessionId = conversationId || currentSessionId;

          // Get messages from the appropriate source
          let existingMessages: Message[];
          if (!currentSessionId || currentSessionId.startsWith('temp-')) {
            // New chat - use userMessage directly (pendingMessages would be stale in this closure)
            existingMessages = [userMessage];
          } else {
            // Existing chat - get from query cache
            existingMessages = queryClient.getQueryData<Message[]>(['chat-messages', currentSessionId]) || [];
          }

          // Filter out streaming message and add final AI message
          const filteredMessages = existingMessages.filter(m => !m.metadata?.isStreaming);
          const updatedMessages = [...filteredMessages, finalMessage];

          // Update the query cache with final messages
          queryClient.setQueryData<Message[]>(
            ['chat-messages', targetSessionId],
            updatedMessages
          );

          // Clear pending messages now that we have a real session ID
          if (!currentSessionId || currentSessionId.startsWith('temp-')) {
            setPendingMessages([]);
          }

          // Clean up old cache key if different
          if (currentSessionId && conversationId && conversationId !== currentSessionId) {
            queryClient.removeQueries({ queryKey: ['chat-messages', currentSessionId] });
          }

          // Update session ID if new
          if (conversationId && (!currentSessionId || currentSessionId.startsWith('temp-'))) {
            setSelectedSessionId(conversationId);
          }

          // Refresh sessions to get new title (5s delay to allow for title generation)
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
          }, 5000);
        },
        // onError - fall back to non-streaming
        async (error) => {
          console.error('[useChat] Streaming failed, falling back to regular:', error);
          setIsStreaming(false);
          streamingMessageRef.current = '';

          // Remove streaming message but keep user message
          queryClient.setQueryData<Message[]>(
            ['chat-messages', currentSessionId],
            (old = []) => old.filter(m => !m.metadata?.isStreaming)
          );

          // Fall back to non-streaming
          try {
            const response = await chatService.sendMessage({
              message,
              sessionId: currentSessionId || undefined,
              fileContext,
            });

            const { message: aiMessage, conversationId } = response;

            if (conversationId && (!currentSessionId || currentSessionId.startsWith('temp-'))) {
              setSelectedSessionId(conversationId);
            }

            queryClient.setQueryData<Message[]>(
              ['chat-messages', conversationId || currentSessionId],
              (old = []) => [...old.filter(m => m.id !== userMessage.id), { ...userMessage, sessionId: conversationId || currentSessionId || '' }, aiMessage]
            );

            queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
          } catch (fallbackError) {
            console.error('[useChat] Fallback also failed:', fallbackError);
            queryClient.setQueryData<Message[]>(
              ['chat-messages', currentSessionId],
              (old = []) => old.filter(m => m.id !== userMessage.id)
            );
            toast.error('Failed to send message');
          }
        },
        // onRetry - reset streaming content for new attempt
        (attempt) => {
          console.log('[useChat] Server retrying, attempt:', attempt);
          streamingMessageRef.current = '';
          // Update UI to show empty streaming message (reset)
          if (!currentSessionId || currentSessionId.startsWith('temp-')) {
            setPendingMessages(prev => prev.map(msg => {
              if (msg.metadata?.isStreaming) {
                return { ...msg, content: '' };
              }
              return msg;
            }));
          } else {
            queryClient.setQueryData<Message[]>(
              ['chat-messages', currentSessionId],
              (old = []) => old.map(msg => {
                if (msg.metadata?.isStreaming) {
                  return { ...msg, content: '' };
                }
                return msg;
              })
            );
          }
        }
      );
    } catch (e) {
      console.error('[useChat] Streaming exception:', e);
      setIsStreaming(false);
      toast.error('Failed to send message');
    }
  }, [selectedSessionId, queryClient]);

  const sendMessage = useCallback(async (message: string, fileContext?: { id: string } | { type: 'multiple'; files: { id: string; name: string }[] }) => {
    if (!(await checkAndGate('chat', 'chat_send'))) return;

    // Use streaming by default
    if (useStreaming) {
      await sendMessageStreaming(message, fileContext);
      invalidateCache();
      return;
    }

    // Fallback to non-streaming
    const currentSessionId = selectedSessionId;
    console.log('[useChat] Sending message with sessionId:', currentSessionId);

    await sendMessageMutation.mutateAsync({
      message,
      sessionId: currentSessionId || undefined,
      fileContext,
    });
    invalidateCache();
  }, [selectedSessionId, sendMessageMutation, useStreaming, sendMessageStreaming]);

  return {
    sessions,
    messages,
    selectedSessionId,
    selectedSession: sessions.find(s => s.id === selectedSessionId),
    isLoading: sessionsLoading || messagesLoading,
    isSending: sendMessageMutation.isPending || isStreaming,
    isStreaming,
    selectSession,
    createSession: createSessionMutation.mutate,
    sendMessage,
    deleteSession: deleteSessionMutation.mutate,
  };
};