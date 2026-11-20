import { useState } from 'react';
import { 
  Box, 
  Container, 
  Paper, 
  Drawer, 
  List, 
  ListItem, 
  ListItemText,
  ListItemButton,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Divider,
  Button,
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { ChatInterface } from '../components/chat/ChatInterface';
import { chatService } from '../services/chat.service';

export function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(true);
  
  // Get user's conversations using REST API
  const { data: conversations } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => chatService.getSessions(),
  });

  const handleNewChat = () => {
    setSelectedConversationId(undefined);
  };

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            AI Tutor Chat
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? 280 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            mt: '64px', // Height of AppBar
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNewChat}
          >
            New Chat
          </Button>
        </Box>
        <Divider />
        <List>
          {conversations?.map((conv) => (
            <ListItem key={conv.id} disablePadding>
              <ListItemButton
                selected={conv.id === selectedConversationId}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <ListItemText
                  primary={conv.title}
                  secondary={new Date(conv.last_message || Date.now()).toLocaleDateString()}
                  primaryTypographyProps={{
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: '64px', // Height of AppBar
          ml: drawerOpen ? 0 : '-280px',
          transition: 'margin-left 0.3s',
          height: 'calc(100vh - 64px)',
        }}
      >
        <Container maxWidth="lg" sx={{ height: '100%', p: 0 }}>
          <Paper elevation={3} sx={{ height: '100%', overflow: 'hidden' }}>
            <ChatInterface conversationId={selectedConversationId} />
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}