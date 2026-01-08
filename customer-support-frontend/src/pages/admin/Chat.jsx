// src/pages/admin/Chat.js
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  FiUsers,
  FiX,
  FiSearch,
  FiClock
} from 'react-icons/fi';
import { format, formatDistanceToNow } from 'date-fns';

const AdminChat = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  const [message, setMessage] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);

  // Fetch all rooms
  const { data: roomsData, isLoading: isLoadingRooms } = useQuery({
    queryKey: ['admin-rooms'],
    queryFn: () => chatAPI.getAdminRooms(),
    refetchInterval: 5000,
  });

  // Fetch chat history for selected room
  const { data: messagesData, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['chat-history', selectedRoom],
    queryFn: () => selectedRoom ? chatAPI.getChatHistory(selectedRoom) : null,
    enabled: !!selectedRoom,
    refetchInterval: 3000,
  });

  // Auto-select room from URL or first active room
  useEffect(() => {
    if (roomsData?.data) {
      const rooms = roomsData.data;
      if (roomId) {
        const room = rooms.find(r => r.id === roomId);
        if (room) setSelectedRoom(room.id);
      } else if (rooms.length > 0 && !selectedRoom) {
        const activeRoom = rooms.find(r => r.isActive) || rooms[0];
        setSelectedRoom(activeRoom.id);
      }
    }
  }, [roomsData, roomId, selectedRoom]);

  // Join socket room when room is selected
  useEffect(() => {
    if (socket && selectedRoom) {
      socket.emit('join_room', selectedRoom);
    }
  }, [socket, selectedRoom]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!socket || !selectedRoom || !message.trim()) return;
      
      const rooms = roomsData?.data || [];
      const room = rooms.find(r => r.id === selectedRoom);
      if (!room) return;
      
      const messageData = {
        roomId: selectedRoom,
        message: message.trim(),
        messageType: 'text',
        receiverId: room.customerId,
      };
      
      socket.emit('send_message', messageData);
      return messageData;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries(['chat-history', selectedRoom]);
      queryClient.invalidateQueries(['admin-rooms']);
    },
    onError: (error) => {
      toast.error('Failed to send message');
    },
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: (messageIds) => chatAPI.markMessagesAsRead(messageIds),
  });

  // Close room mutation
  const closeRoomMutation = useMutation({
    mutationFn: (roomId) => chatAPI.closeChatRoom(roomId),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-rooms']);
      toast.success('Chat room closed');
    },
    onError: () => {
      toast.error('Failed to close chat room');
    },
  });

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (data) => {
      if (data.roomId === selectedRoom) {
        queryClient.invalidateQueries(['chat-history', selectedRoom]);
        queryClient.invalidateQueries(['admin-rooms']);
        toast.info('New message received!');
      }
    };

    const handleMessagesRead = (data) => {
      if (data.roomId === selectedRoom) {
        queryClient.invalidateQueries(['chat-history', selectedRoom]);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [socket, selectedRoom, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && !sendMessageMutation.isLoading) {
      sendMessageMutation.mutate();
    }
  };

  const handleCloseRoom = () => {
    if (selectedRoom && window.confirm('Are you sure you want to close this chat?')) {
      closeRoomMutation.mutate(selectedRoom);
    }
  };

  const rooms = roomsData?.data || [];
  const selectedRoomData = rooms.find(r => r.id === selectedRoom);
  const messages = messagesData?.data || [];

  // Filter rooms based on search term
  const filteredRooms = searchTerm
    ? rooms.filter(room =>
        room.customer?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        room.roomName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : rooms;

  // Get unread messages for the selected room
  const unreadMessages = messages.filter(
    msg => !msg.isRead && msg.senderId !== user?.id
  );

  // Mark unread messages as read
  useEffect(() => {
    if (unreadMessages.length > 0 && socket && selectedRoom) {
      const messageIds = unreadMessages.map(msg => msg.id);
      markAsReadMutation.mutate(messageIds);
      socket.emit('mark_as_read', { messageIds, roomId: selectedRoom });
    }
  }, [unreadMessages.length, selectedRoom]);

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM dd');
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Sidebar - Chat Rooms List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Chats</h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
              {rooms.length || 0}
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email or room..."
              className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoadingRooms ? (
            <div className="p-4 text-center text-gray-500">Loading chats...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No chats found' : 'No active chats'}
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedRoom === room.id 
                    ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                    : room.isActive 
                      ? 'bg-green-50' 
                      : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      room.isActive ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <span className={`font-semibold ${
                        room.isActive ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {room.customer?.email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {room.customer?.email || 'Unknown User'}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        <FiClock className="w-3 h-3 mr-1" />
                        {room.lastMessageAt 
                          ? formatDistanceToNow(new Date(room.lastMessageAt), { addSuffix: true })
                          : 'No messages'
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {room.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mb-1">
                        {room.unreadCount}
                      </span>
                    )}
                    <div className="flex items-center space-x-1">
                      {room.isActive ? (
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      ) : (
                        <span className="text-xs text-gray-500">Closed</span>
                      )}
                    </div>
                  </div>
                </div>
                {room.lastMessage && (
                  <p className="text-xs text-gray-600 truncate mt-2 ml-13">
                    {room.lastMessage}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-gray-200 p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedRoomData?.isActive ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <span className={`text-lg font-semibold ${
                      selectedRoomData?.isActive ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {selectedRoomData?.customer?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {selectedRoomData?.customer?.email || 'Unknown User'}
                    </h3>
                    <div className="flex items-center space-x-3 text-sm text-gray-500">
                      <span className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          selectedRoomData?.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                        }`}></div>
                        {selectedRoomData?.isActive ? 'Online • Active' : 'Offline • Closed'}
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">
                        Room: {selectedRoomData?.roomName?.slice(-8)}
                      </span>
                      <span>•</span>
                      <span>
                        Created: {format(new Date(selectedRoomData?.created_at), 'MMM dd')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!selectedRoomData?.isActive && (
                    <button
                      onClick={() => toast.info('This chat room is already closed')}
                      className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Room Closed
                    </button>
                  )}
                  {selectedRoomData?.isActive && (
                    <button
                      onClick={handleCloseRoom}
                      disabled={closeRoomMutation.isLoading}
                      className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                    >
                      {closeRoomMutation.isLoading ? 'Closing...' : 'Close Chat'}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedRoom(null)}
                    className="md:hidden p-2 text-gray-500 hover:text-gray-700"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <FiUsers className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                  <p className="text-sm text-center max-w-md">
                    Start the conversation by sending a message to the customer
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isSender = msg.senderId === user?.id;
                    const isRead = msg.isRead;
                    
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                            isSender
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-white text-gray-800 shadow rounded-bl-none'
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </div>
                          <div className={`text-xs mt-2 flex items-center space-x-2 ${
                            isSender ? 'text-blue-200 justify-end' : 'text-gray-500 justify-between'
                          }`}>
                            <span>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                            {isSender && (
                              <div className="flex items-center space-x-1">
                                {isRead ? (
                                  <>
                                    <FiCheckCircle className="w-3.5 h-3.5" />
                                    <span className="text-xs">Read</span>
                                  </>
                                ) : (
                                  <>
                                    <FiCheck className="w-3.5 h-3.5" />
                                    <span className="text-xs">Sent</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                      placeholder={selectedRoomData?.isActive 
                        ? "Type your message..." 
                        : "This chat room is closed"
                      }
                      disabled={!selectedRoomData?.isActive || sendMessageMutation.isLoading}
                      className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (message.trim() && selectedRoomData?.isActive) {
                            handleSendMessage(e);
                          }
                        }
                      }}
                    />
                    <div className="absolute right-3 top-3 flex items-center space-x-2">
                      <button
                        type="button"
                        className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors disabled:hover:text-gray-500"
                        disabled={!selectedRoomData?.isActive}
                      >
                        <FiSmile className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors disabled:hover:text-gray-500"
                        disabled={!selectedRoomData?.isActive}
                      >
                        <FiPaperclip className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!message.trim() || !selectedRoomData?.isActive || sendMessageMutation.isLoading}
                  className="bg-blue-600 text-white p-3.5 rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  <FiSend className="w-5 h-5" />
                </button>
              </form>
              {!selectedRoomData?.isActive && (
                <p className="text-sm text-red-600 text-center mt-2">
                  This chat room has been closed. No new messages can be sent.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <div className="w-32 h-32 bg-blue-100 rounded-full flex items-center justify-center mb-8">
              <FiUsers className="w-16 h-16 text-blue-600" />
            </div>
            <h3 className="text-2xl font-medium mb-3">Welcome to Admin Chat</h3>
            <p className="text-center max-w-md mb-6">
              Select a conversation from the sidebar to start chatting with customers.
              Active chats are highlighted in green.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span>Active Chat</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span>Unread Messages</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span>Closed Chat</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                <span>Online Customer</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChat;