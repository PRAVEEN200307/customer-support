// src/pages/customer/Chat.js
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  FiImage,
  FiFile,
  FiVideo
} from 'react-icons/fi';
import { format } from 'date-fns';

const CustomerChat = () => {
  const [message, setMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch chat room
  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ['chat-room'],
    queryFn: () => chatAPI.getMyRoom(),
    onSuccess: (data) => {
      setRoomId(data.data.id);
      if (socket) {
        socket.emit('join_room', data.data.id);
      }
    },
  });

  // Fetch chat history
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-history', roomId],
    queryFn: () => roomId ? chatAPI.getChatHistory(roomId) : null,
    enabled: !!roomId,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!socket || !roomId || !message.trim()) return;
      
      const messageData = {
        roomId,
        message: message.trim(),
        messageType: 'text',
        receiverId: roomData?.data?.adminId,
      };
      socket.emit('send_message', messageData);
      return messageData;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries(['chat-history', roomId]);
    },
  });

  // Mark messages as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (messageIds) => chatAPI.markMessagesAsRead(messageIds),
  });

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      queryClient.invalidateQueries(['chat-history', roomId]);
      toast.success('New message received!');
    };

    const handleMessageRead = (data) => {
      queryClient.invalidateQueries(['chat-history', roomId]);
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_read', handleMessageRead);
    };
  }, [socket, roomId, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  // Typing indicator
  const handleTyping = () => {
    if (!socket || !roomId) return;
    
    socket.emit('typing', { roomId, isTyping: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomId, isTyping: false });
    }, 1000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate();
    }
  };

  const messages = messagesData?.data || [];
  const unreadMessages = messages.filter(msg => !msg.isRead && msg.senderId !== user.id);

  // Mark unread messages as read
  useEffect(() => {
    if (unreadMessages.length > 0 && socket) {
      const messageIds = unreadMessages.map(msg => msg.id);
      markAsReadMutation.mutate(messageIds);
      socket.emit('mark_as_read', { messageIds, roomId });
    }
  }, [unreadMessages.length, roomId]);

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <FiCheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Support Chat</h2>
                <p className="text-blue-100 text-sm">
                  {roomData?.data?.adminId ? 'Connected with support agent' : 'Waiting for agent...'}
                </p>
              </div>
            </div>
            <div className="text-white">
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                Room: {roomId?.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="h-[500px] overflow-y-auto p-4 bg-gray-50">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FiSend className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">No messages yet</h3>
              <p className="text-sm">Start a conversation with our support team</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      msg.senderId === user.id
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-white text-gray-800 shadow rounded-bl-none'
                    }`}
                  >
                    <div className="text-sm">{msg.message}</div>
                    <div className={`text-xs mt-1 flex items-center justify-end space-x-1 ${
                      msg.senderId === user.id ? 'text-blue-200' : 'text-gray-500'
                    }`}>
                      <span>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                      {msg.senderId === user.id && (
                        <>
                          {msg.isRead ? (
                            <FiCheckCircle className="w-3 h-3" />
                          ) : (
                            <FiCheck className="w-3 h-3" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Typing Indicator */}
        {typing && (
          <div className="px-6 py-2 bg-gray-100 border-t">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-200"></div>
              </div>
              <span className="text-sm text-gray-600">Agent is typing...</span>
            </div>
          </div>
        )}

        {/* Message Input */}
        <div className="border-t bg-white p-4">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="absolute right-3 top-3 flex items-center space-x-2">
                  <button
                    type="button"
                    className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <FiSmile className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <FiPaperclip className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={!message.trim() || sendMessageMutation.isLoading}
              className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              <FiSend className="w-5 h-5" />
            </button>
          </form>
          
          {/* Attachment Options */}
          <div className="flex items-center justify-center space-x-4 mt-4 pt-4 border-t">
            <button className="flex flex-col items-center space-y-1 text-gray-600 hover:text-blue-600 transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FiImage className="w-4 h-4" />
              </div>
              <span className="text-xs">Image</span>
            </button>
            <button className="flex flex-col items-center space-y-1 text-gray-600 hover:text-blue-600 transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FiVideo className="w-4 h-4" />
              </div>
              <span className="text-xs">Video</span>
            </button>
            <button className="flex flex-col items-center space-y-1 text-gray-600 hover:text-blue-600 transition-colors">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FiFile className="w-4 h-4" />
              </div>
              <span className="text-xs">File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerChat;