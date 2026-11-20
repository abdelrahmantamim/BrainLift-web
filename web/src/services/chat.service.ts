import api from './api';
import type { Message, ChatSession, SendMessageRequest } from '@/types/chat.types';

class ChatService {
  async getSessions(): Promise<ChatSession[]> {
    const response = await api.get<{ conversations: ChatSession[] }>('/chat/history');
    // Map server format to frontend format
    return (response.data.conversations || []).map(session => ({
      ...session,
      createdAt: session.created_at || session.createdAt,
      updatedAt: session.updated_at || session.updatedAt || session.created_at || session.createdAt,
      messageCount: session.message_count ?? session.messageCount ?? 0,
    }));
  }

  async getSession(sessionId: string): Promise<ChatSession> {
    // Since server doesn't have individual session endpoint, fetch from history
    const sessions = await this.getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session;
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    try {
      const response = await api.get<{
        conversation?: { messages: unknown[] };
        messages?: unknown[];
      }>(`/chat/conversation/${sessionId}`);

      // Handle both response formats
      const messages = response.data.messages || response.data.conversation?.messages || [];

      // Map server format to frontend format
      return messages.map((msg: unknown) => {
        const msgData = msg as { id?: string; message_id?: string; content: string; role: string; created_at?: string; timestamp?: string };
        return {
          id: msgData.id || msgData.message_id || `msg-${Date.now()}-${Math.random()}`,
          content: msgData.content,
          role: msgData.role as 'user' | 'assistant',
          timestamp: msgData.created_at || msgData.timestamp || new Date().toISOString(),
          sessionId: sessionId,
        };
      });
    } catch {
      console.error('Error fetching messages');
      return [];
    }
  }

  async sendMessage(data: SendMessageRequest): Promise<{ message: Message; conversationId: string }> {
    const response = await api.post<{
      message: string;
      conversationId: string;
      formattedMessage?: unknown;
      actions?: unknown[];
    }>('/chat/message', {
      message: data.message,
      conversationId: data.sessionId?.startsWith('temp-') ? undefined : data.sessionId,
      fileContext: data.fileContext,
    });

    // Transform server response to Message type
    const message: Message = {
      id: `msg-${Date.now()}`,
      content: response.data.message,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      sessionId: response.data.conversationId,
    };

    return {
      message,
      conversationId: response.data.conversationId,
    };
  }

  async createSession(title?: string): Promise<ChatSession> {
    // Sessions are created automatically when sending first message
    // Return a temporary session object
    const now = new Date().toISOString();
    return {
      id: `temp-${Date.now()}`,
      title: title || 'New Chat',
      created_at: now,
      createdAt: now,
      updated_at: now,
      updatedAt: now,
      message_count: 0,
      messageCount: 0,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    await api.delete(`/chat/conversation/${sessionId}`);
  }

  async updateSession(sessionId: string, data: Partial<ChatSession>): Promise<ChatSession> {
    // Server doesn't support updating sessions yet
    const session = await this.getSession(sessionId);
    return { ...session, ...data };
  }

  async sendMessageStream(
    data: SendMessageRequest,
    onChunk: (chunk: string) => void,
    onDone: (fullContent: string, conversationId: string) => void,
    onError: (error: string) => void,
    onRetry?: (attempt: number) => void
  ): Promise<void> {
    const token = localStorage.getItem('authToken'); // Must match TOKEN_KEY in constants.ts
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    try {
      const response = await fetch(`${baseUrl}/chat/message/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          message: data.message,
          conversationId: data.sessionId?.startsWith('temp-') ? undefined : data.sessionId,
          fileContext: data.fileContext,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Stream] Request failed:', response.status, errorText);
        throw new Error(`Streaming request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let conversationId = data.sessionId || '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));

              if (eventData.type === 'session') {
                conversationId = eventData.conversationId;
              } else if (eventData.type === 'chunk') {
                fullContent += eventData.content;
                onChunk(eventData.content);
              } else if (eventData.type === 'retry') {
                // Server is retrying due to empty response - clear content and wait
                console.log('[Stream] Server retrying, attempt:', eventData.attempt);
                fullContent = ''; // Reset for new attempt
                if (onRetry) onRetry(eventData.attempt);
              } else if (eventData.type === 'done') {
                onDone(eventData.fullContent || fullContent, conversationId);
              } else if (eventData.type === 'error') {
                onError(eventData.message);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Streaming failed');
    }
  }
}

export const chatService = new ChatService();
