import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Badge,
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  SupportAgent as SupportIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { chatService } from '../../services/chat';
import socketService from '../../services/socket';
import toast from 'react-hot-toast';

const CustomerChat = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [adminOnline, setAdminOnline] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initializeChat();
    setupSocketListeners();

    return () => {
      socketService.disconnect();
    };
  }, []);

  const initializeChat = async () => {
    try {
      // Get or create chat room
      const roomResponse = await chatService.getMyRoom();
      setRoomId(roomResponse.data.id);

      // Load chat history
      const historyResponse = await chatService.getChatHistory(
        roomResponse.data.id
      );
      setMessages(historyResponse.data.messages || []);

      // Connect to socket
      socketService.connect();
      socketService.joinRoom(roomResponse.data.id);

      // Get unread count
      const unreadResponse = await chatService.getUnreadCount();
      console.log('Unread messages:', unreadResponse.data.count);
    } catch (error) {
      toast.error('Failed to initialize chat');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
      scrollToBottom();
    });

    socketService.on('user_typing', (data) => {
      if (data.roomId === roomId) {
        setTyping(data.isTyping);
      }
    });

    socketService.on('message_sent', () => {
      // Message sent confirmation
    });

    socketService.on('admin_online', (data) => {
      setAdminOnline(data.isOnline);
      if (data.isOnline) {
        toast.success('Support agent is now online');
      }
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId) return;

    const messageData = {
      receiverId: 'admin', // This would be dynamic in real implementation
      message: newMessage,
      messageType: 'text',
      roomId,
    };

    socketService.sendMessage(messageData);
    setNewMessage('');

    // Simulate sending
    const tempMessage = {
      id: Date.now().toString(),
      message: newMessage,
      senderId: 'customer',
      senderType: 'customer',
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    setMessages((prev) => [...prev, tempMessage]);
  };

  const handleTyping = (isTyping) => {
    socketService.typing({
      roomId,
      isTyping,
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
          <SupportIcon />
        </Avatar>
        <Box>
          <Typography variant="h6">Customer Support</Typography>
          <Typography variant="caption" color={adminOnline ? 'success.main' : 'text.secondary'}>
            {adminOnline ? 'Online' : 'Offline'}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Badge
          color={adminOnline ? 'success' : 'error'}
          variant="dot"
          sx={{ mr: 2 }}
        >
          <Typography variant="caption">
            {adminOnline ? 'Available' : 'Away'}
          </Typography>
        </Badge>
      </Paper>

      {/* Messages Area */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'grey.50',
        }}
      >
        <List>
          {messages.map((msg) => (
            <ListItem
              key={msg.id}
              sx={{
                flexDirection: msg.senderType === 'customer' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                mb: 1,
              }}
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    bgcolor:
                      msg.senderType === 'customer'
                        ? 'primary.main'
                        : 'secondary.main',
                  }}
                >
                  {msg.senderType === 'customer' ? <PersonIcon /> : <SupportIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={msg.message}
                secondary={format(new Date(msg.createdAt), 'HH:mm')}
                sx={{
                  bgcolor:
                    msg.senderType === 'customer'
                      ? 'primary.light'
                      : 'grey.100',
                  color:
                    msg.senderType === 'customer' ? 'primary.contrastText' : 'text.primary',
                  borderRadius: 2,
                  p: 2,
                  maxWidth: '70%',
                  ml: msg.senderType === 'customer' ? 0 : 2,
                  mr: msg.senderType === 'customer' ? 2 : 0,
                }}
              />
            </ListItem>
          ))}
          {typing && (
            <ListItem>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  <SupportIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary="Typing..."
                sx={{
                  fontStyle: 'italic',
                  color: 'text.secondary',
                }}
              />
            </ListItem>
          )}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      {/* Typing indicator and Input */}
      <Paper
        component="form"
        onSubmit={handleSendMessage}
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        {typing && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            Support agent is typing...
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping(true);
            }}
            onBlur={() => handleTyping(false)}
            disabled={!adminOnline}
          />
          <IconButton
            type="submit"
            color="primary"
            disabled={!newMessage.trim() || !adminOnline}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default CustomerChat;