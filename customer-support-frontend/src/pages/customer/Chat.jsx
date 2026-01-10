import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  FiSend, 
  FiPaperclip, 
  FiSmile, 
  FiCheck, 
  FiCheckCircle,
  FiMessageSquare,
  FiTrash2,
  FiClock,
  FiUser,
  FiAlertCircle
} from 'react-icons/fi';
import { format, isToday, isYesterday } from 'date-fns';

const CustomerChat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch or create customer's room (only once)
  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ['my-room'],
    queryFn: () => chatAPI.getMyRoom(),
    staleTime: 30000, // Cache for 30 seconds
  });

  const roomId = roomData?.data?.room?.id;

  // Fetch initial chat history (only once when room is loaded)
  const fetchInitialHistory = useCallback(async () => {
    if (!roomId) return [];
    try {
      const response = await chatAPI.getChatHistory(roomId, 50, 0);
      return response.data.messages || [];
    } catch (error) {
      console.error('Error fetching initial history:', error);
      return [];
    }
  }, [roomId]);

  // Load initial history when room is available
  useEffect(() => {
    if (roomId && messages.length === 0) {
      fetchInitialHistory().then(initialMessages => {
        setMessages(initialMessages);
      });
    }
  }, [roomId, fetchInitialHistory, messages.length]);

  // Join socket room when room is available
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('join_room', roomId);
      console.log('Customer joined room:', roomId);
    }
  }, [socket, roomId]);

  // Setup WebSocket event handlers
  useEffect(() => {
    if (!socket || !roomId) return;

    // Handle incoming messages
    const handleReceiveMessage = (data) => {
      console.log('Customer received message:', data);
      
      if (data.roomId !== roomId) return;

      // Ensure message has timestamp
      const messageWithTimestamp = {
        ...data,
        createdAt: data.createdAt || data.created_at || new Date().toISOString()
      };

      setMessages(prev => {
        // Check if message already exists
        if (prev.some(msg => msg.id === data.id)) {
          return prev;
        }

        // For our own messages, check if there's an optimistic version
        const isOurOwnMessage = data.senderId === user?.id;
        if (isOurOwnMessage) {
          const optimisticIndex = prev.findIndex(
            msg => msg.isOptimistic && msg.message === data.message
          );
          
          if (optimisticIndex !== -1) {
            const newMessages = [...prev];
            newMessages[optimisticIndex] = messageWithTimestamp;
            
            // Sort by timestamp
            newMessages.sort((a, b) => 
              new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );
            return newMessages;
          }
        }

        const newMessages = [...prev, messageWithTimestamp];
        
        // Sort by timestamp
        newMessages.sort((a, b) => 
          new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
        
        return newMessages;
      });

      // Show notification for messages from admin
      if (data.senderId !== user?.id) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} 
            max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <FiMessageSquare className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    New message from Support
                  </p>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    {data.message.length > 50 
                      ? `${data.message.substring(0, 50)}...` 
                      : data.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ));
      }
    };

    // Handle typing indicator from admin
    const handleUserTyping = (data) => {
      if (data.roomId === roomId && data.userId !== user?.id) {
        setTyping(data.isTyping);
        
        // Clear typing indicator after 2 seconds
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
          }, 2000);
        }
      }
    };

    // Handle message read confirmation
    const handleMessageRead = (data) => {
      if (data.roomId === roomId) {
        setMessages(prev => 
          prev.map(msg => 
            data.messageIds.includes(msg.id) 
              ? { ...msg, isRead: true }
              : msg
          )
        );
      }
    };

    // Handle admin online status
    const handleAdminOnline = (data) => {
      if (data.isOnline) {
        toast.success('Support team is now online');
      } else {
        toast.info('Support team is offline');
      }
    };

    // Attach event listeners
    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_read', handleMessageRead);
    socket.on('admin_online', handleAdminOnline);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_read', handleMessageRead);
      socket.off('admin_online', handleAdminOnline);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, roomId, user?.id]);

  // Handle typing indicator for customer
  useEffect(() => {
    if (socket && roomId && message.trim()) {
      socket.emit('typing', {
        roomId,
        isTyping: true
      });

      // Clear typing after 1 second of inactivity
      const timeout = setTimeout(() => {
        socket.emit('typing', {
          roomId,
          isTyping: false
        });
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [message, socket, roomId]);

  // Mark unread messages as read when they appear
  useEffect(() => {
    if (socket && roomId && messages.length > 0) {
      const unreadMessages = messages.filter(
        msg => !msg.isRead && msg.senderId !== user?.id
      );

      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);

        // Update local state immediately
        setMessages(prev => 
          prev.map(msg => 
            messageIds.includes(msg.id) 
              ? { ...msg, isRead: true }
              : msg
          )
        );

        // Send to server
        socket.emit('mark_as_read', {
          messageIds,
          roomId
        });
      }
    }
  }, [messages.length, socket, roomId, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message with optimistic update
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!socket || !roomId || !message.trim()) {
      return;
    }

    const messageData = {
      roomId,
      message: message.trim(),
      messageType: 'text',
      receiverId: null, // Let server handle admin assignment
    };

    // Generate optimistic message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      id: tempId,
      roomId,
      senderId: user?.id,
      senderEmail: user?.email,
      receiverId: null,
      message: message.trim(),
      messageType: 'text',
      isRead: false,
      createdAt: new Date().toISOString(),
      isOptimistic: true
    };

    // Add optimistic message to UI immediately
    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage];
      newMessages.sort((a, b) => 
        new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      );
      return newMessages;
    });

    // Send via socket
    socket.emit('send_message', messageData, (ack) => {
      if (ack?.success) {
        console.log('Message sent successfully');
      } else {
        // Remove optimistic message on error
        setMessages(prev => 
          prev.filter(msg => msg.id !== tempId)
        );
        toast.error(ack?.error || 'Failed to send message');
      }
    });

    setMessage('');
  };

  // Clear chat history
  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear chat history?')) {
      try {
        await chatAPI.clearChatHistory(roomId);
        setMessages([]);
        toast.success('Chat history cleared');
      } catch (error) {
        toast.error('Failed to clear chat history');
      }
    }
  };

  // Filter out duplicate optimistic messages
  const getDisplayMessages = () => {
    return messages.filter((msg, index, array) => {
      if (!msg.isOptimistic) return true;
      
      // Check if there's a real message with same content
      const hasRealDuplicate = array.some(otherMsg => 
        !otherMsg.isOptimistic && 
        otherMsg.message === msg.message && 
        otherMsg.senderId === msg.senderId &&
        Math.abs(new Date(otherMsg.createdAt || 0) - new Date(msg.createdAt || 0)) < 2000
      );
      
      return !hasRealDuplicate;
    });
  };

  const displayMessages = getDisplayMessages();

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};

    messages.forEach((msg) => {
      const timestamp = msg.createdAt || msg.created_at;
      if (!timestamp) return;

      const date = new Date(timestamp);
      let dateKey;

      if (isToday(date)) {
        dateKey = 'Today';
      } else if (isYesterday(date)) {
        dateKey = 'Yesterday';
      } else {
        dateKey = format(date, 'MMMM dd, yyyy');
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate(displayMessages);

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Connecting to chat...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      {/* Chat Header */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <FiUser className="text-white w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Support Chat</h3>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  Support team online
                </span>
                {typing && (
                  <span className="text-xs text-blue-600 font-medium animate-pulse">
                    typing...
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleClearChat}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Clear Chat History"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
              <FiMessageSquare className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Welcome to Support</h3>
            <p className="text-gray-600 text-center max-w-md mb-8">
              How can we help you today? Send a message to start a conversation with our support team.
            </p>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span>Support team is online</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span>Messages are real-time</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(messageGroups).map(([date, dateMessages]) => (
              <div key={date}>
                <div className="sticky top-0 z-10 flex justify-center mb-4">
                  <div className="bg-blue-100 text-blue-800 text-xs font-medium px-4 py-2 rounded-full shadow-sm">
                    {date}
                  </div>
                </div>
                <div className="space-y-2">
                  {dateMessages.map((msg) => {
                    const isSender = msg.senderId === user?.id;
                    const isRead = msg.isRead;
                    const isOptimistic = msg.isOptimistic;
                    const timestamp = msg.createdAt ? new Date(msg.createdAt) : null;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-2 px-4`}
                      >
                        {/* WhatsApp-style message bubble */}
                        <div
                          className={`relative max-w-[65%] rounded-2xl px-3 py-2 ${
                            isSender
                              ? isOptimistic
                                ? "bg-[#D9FDD3] opacity-70 rounded-tr-sm"
                                : "bg-[#DCF8C6] rounded-tr-sm"
                              : "bg-white rounded-tl-sm border border-gray-200"
                          } shadow-sm`}
                        >
                          {/* Message content */}
                          <div className="text-sm whitespace-pre-wrap break-words pb-1">
                            {msg.message}
                          </div>

                          {/* Timestamp and status row */}
                          <div
                            className={`flex items-center justify-end mt-1 space-x-1 ${
                              isSender ? "" : "justify-end"
                            }`}
                          >
                            {/* Time */}
                            {timestamp && (
                              <span className="text-xs text-gray-500">
                                {format(timestamp, "HH:mm")}
                              </span>
                            )}

                            {/* Status icons for sender */}
                            {isSender && (
                              <div className="flex items-center">
                                {isOptimistic ? (
                                  <div className="flex items-center space-x-1 ml-1">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-gray-400 italic">
                                      Sending
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    {/* Single check for sent, double check for delivered, blue double check for read */}
                                    {isRead ? (
                                      <FiCheckCircle className="w-3.5 h-3.5 text-blue-500 ml-1" />
                                    ) : (
                                      <div className="relative w-3.5 h-3.5 ml-1">
                                        <FiCheck className="w-3.5 h-3.5 text-gray-500 absolute top-0 left-0" />
                                        <FiCheck className="w-3.5 h-3.5 text-gray-500 absolute top-0 left-1" />
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* WhatsApp-style bubble tail */}
                          {isSender ? (
                            <div className="absolute -right-2 top-0 w-2 h-4 overflow-hidden">
                              <div className="w-4 h-4 bg-[#DCF8C6] transform rotate-45 origin-bottom-left"></div>
                            </div>
                          ) : (
                            <div className="absolute -left-2 top-0 w-2 h-4 overflow-hidden">
                              <div className="w-4 h-4 bg-white transform rotate-45 origin-bottom-right border-l border-b border-gray-200"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) {
                      handleSendMessage(e);
                    }
                  }
                }}
              />
              <div className="absolute right-3 top-3 flex items-center space-x-2">
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <FiSmile className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <FiPaperclip className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={!message.trim()}
            className="bg-blue-600 text-white p-3.5 rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            <FiSend className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerChat;