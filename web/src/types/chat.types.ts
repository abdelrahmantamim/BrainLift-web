export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sessionId: string;
  metadata?: {
    model?: string;
    tokens?: number;
    fileContext?: string[];
    isThinking?: boolean;
    isStreaming?: boolean;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  message_count?: number;
  last_message?: string;
  subject?: string;
  // Frontend specific fields
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
}

export interface SendMessageRequest {
  message: string;
  sessionId?: string;
  fileContext?: { id: string } | { type: 'multiple'; files: { id: string; name: string }[] };
  model?: string;
}