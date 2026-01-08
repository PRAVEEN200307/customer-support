import { useState, useEffect, useRef } from 'react';
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
  FiMessageSquare,
  FiTrash2
} from 'react-icons/fi';
import { format } from 'date-fns';

const CustomerChat = () => {
  const [message, setMessage] = useState('');
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);

  // Fetch or create customer's room
  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ['my-room'],
    queryFn: () => chatAPI.getMyRoom(),
  });

  // console.log('Room Data:', roomData?.data?.room?.id);

  const roomId = roomData?.data?.room?.id;

  // Fetch chat history for the room
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-history', roomId],
    queryFn: () => roomId ? chatAPI.getChatHistory(roomId) : null,
    enabled: !!roomId,
    refetchInterval: 3000,
  });

  // Join socket room
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('join_room', roomId);
    }
  }, [socket, roomId]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {


      if (!socket || !roomId || !message.trim()) return;
      
      const messageData = {
        roomId,
        message: message.trim(),
        messageType: 'text',
        // In customer view, receiver is null or handled by server to broadcast to admins
        receiverId: "ff283a6d-fa7e-4d64-9a1f-044e380162e1", 
      };

      // console.log('Sending message:', messageData);

      
      socket.emit('send_message', messageData);
      return messageData;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries(['chat-history', roomId]);
    },
  });

  // Clear chat mutation
  const clearChatMutation = useMutation({
    mutationFn: () => chatAPI.clearChatHistory(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries(['chat-history', roomId]);
      toast.success('Chat history cleared');
    },
  });

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      if (data.roomId === roomId) {
        queryClient.invalidateQueries(['chat-history', roomId]);
        if (data.senderId !== user.id) {
          toast.info('New message from Support');
        }
      }
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, roomId, queryClient, user.id]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate();
    }
  };

  const messages = messagesData?.data?.messages || [];
  const unreadMessages = messages?.filter(msg => !msg.isRead && msg.senderId !== user.id);

  // Mark unread messages as read
  useEffect(() => {
    if (unreadMessages.length > 0 && socket && roomId) {
      const messageIds = unreadMessages.map(msg => msg.id);
      chatAPI.markMessagesAsRead(messageIds);
      socket.emit('mark_as_read', { messageIds, roomId });
    }
  }, [unreadMessages.length, roomId, socket]);

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              <FiMessageSquare className="text-white w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Support Chat</h3>
              <p className="text-xs text-gray-500 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                Support team is online
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear chat history?')) {
                clearChatMutation.mutate();
              }
            }}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Clear Chat"
          >
            <FiTrash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <FiMessageSquare className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">Welcome to Support</h3>
            <p className="text-sm text-center max-w-xs">
              How can we help you today? Send a message to start a conversation with our team.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.senderId === user.id
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none'
                  }`}
                >
                  <div className="text-sm break-words">{msg.message}</div>
                  <div className={`text-[10px] mt-1 flex items-center justify-end space-x-1 ${
                    msg.senderId === user.id ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
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

      {/* Message Input */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <div className="absolute right-3 top-2.5 flex items-center space-x-1">
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
          <button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isLoading}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            <FiSend className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomerChat;
