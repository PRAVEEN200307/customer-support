import api from './api';

export const chatService = {
  // Get my room
  getMyRoom: async () => {
    const response = await api.get('/chat/my-room');
    return response.data;
  },

  // Get chat history
  getChatHistory: async (roomId, limit = 100, offset = 0) => {
    const response = await api.get(
      `/chat/history/${roomId}?limit=${limit}&offset=${offset}`
    );
    return response.data;
  },

  // Mark messages as read
  markAsRead: async (messageIds) => {
    const response = await api.post('/chat/messages/read', { messageIds });
    return response.data;
  },

  // Clear chat history
  clearChat: async (roomId) => {
    const response = await api.post(`/chat/clear/${roomId}`);
    return response.data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const response = await api.get('/chat/unread-count');
    return response.data;
  },

  // Admin: Get all rooms
  getAllRooms: async () => {
    const response = await api.get('/chat/admin/rooms');
    return response.data;
  }
};