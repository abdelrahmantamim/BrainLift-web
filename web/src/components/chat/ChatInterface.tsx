import { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Paper, 
  Typography,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material';
import { 
  Send as SendIcon, 
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageFormatter } from './MessageFormatter';
import { chatService } from '@/services/chat.service';
import type { Message } from '@/types/chat.types';

interface ChatInterfaceProps {
  conversationId?: string;
  fileIds?: string[];
}


export function ChatInterface({ conversationId: initialConversationId, fileIds = [] }: ChatInterfaceProps) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<string[]>(fileIds);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  // Get conversation and messages if we have a conversationId
  const { data: conversation } = useQuery({
    queryKey: ['chat-session', conversationId],
    queryFn: () => conversationId ? chatService.getSession(conversationId) : null,
    enabled: !!conversationId,
  });
  
  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => conversationId ? chatService.getMessages(conversationId) : [],
    enabled: !!conversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: chatService.sendMessage,
    onSuccess: (data) => {
      if (!conversationId) {
        setConversationId(data.conversationId);
      }
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ queryKey: ['chat-messages', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim()) return;

    const currentMessage = message;
    setMessage('');

    try {
      // Add user message to UI immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        content: currentMessage,
        role: 'user',
        timestamp: new Date().toISOString(),
        sessionId: conversationId || 'temp',
      };

      // Optimistically update the messages cache
      if (conversationId) {
        queryClient.setQueryData(['chat-messages', conversationId], (old: Message[] = []) => [...old, userMessage]);
      }

      // Prepare file context in the format expected by backend
      let fileContext = undefined;
      if (attachedFiles.length > 0) {
        if (attachedFiles.length === 1) {
          // Single file
          fileContext = { id: attachedFiles[0] };
        } else {
          // Multiple files
          fileContext = {
            type: 'multiple' as const,
            files: attachedFiles.map(id => ({ id, name: `file-${id}` }))
          };
        }
      }
      
      await sendMessageMutation.mutateAsync({
        message: currentMessage,
        sessionId: conversationId,
        fileContext,
      });
    } catch {
      console.error('Failed to send message:');
      setMessage(currentMessage); // Restore message on error
      // Remove optimistic update on error
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', conversationId] });
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const removeFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(id => id !== fileId));
  };

  return (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.paper',
    }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6">
          {conversation?.title || 'New Conversation'}
        </Typography>
        {attachedFiles.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {attachedFiles.map((fileId) => (
              <Chip
                key={fileId}
                label={`File ${fileId}`}
                size="small"
                onDelete={() => removeFile(fileId)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Stack>
        )}
      </Paper>

      {/* Messages */}
      <Box sx={{ 
        flex: 1, 
        overflow: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
            }}
          >
            <Paper
              elevation={1}
              sx={{
                p: 2,
                bgcolor: msg.role === 'user' ? 'primary.main' : 'grey.100',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <MessageFormatter 
                content={msg.content} 
                isAI={msg.role === 'assistant'}
              />
            </Paper>
            <Typography 
              variant="caption" 
              sx={{ 
                mt: 0.5, 
                display: 'block',
                textAlign: msg.role === 'user' ? 'right' : 'left',
                color: 'text.secondary',
              }}
            >
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Typography>
          </Box>
        ))}
        
        {sendMessageMutation.isPending && (
          <Box sx={{ 
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              AI is thinking...
            </Typography>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Paper elevation={3} sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <IconButton 
            size="small"
            disabled={conversationId !== undefined}
            title="Attach files (only for new conversations)"
          >
            <AttachFileIcon />
          </IconButton>
          
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={sendMessageMutation.isPending}
            variant="outlined"
            size="small"
          />
          
          <IconButton 
            color="primary"
            onClick={handleSend}
            disabled={!message.trim() || sendMessageMutation.isPending}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
}