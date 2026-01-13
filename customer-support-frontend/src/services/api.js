// src/services/api.js
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
        const { accessToken } = response.data.data;
        
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Show error toast
    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    }

    return Promise.reject(error);
  }
);

export const chatAPI = {
  getMyRoom: () => api.get('/chat/my-room'),
  getChatHistory: (roomId, limit = 100, offset = 0) => {
    const params = typeof limit === 'object' ? limit : { limit, offset };
    return api.get(`/chat/history/${roomId}`, { params });
  },
  markMessagesAsRead: (messageIds) => api.post('/chat/messages/read', { messageIds }),
  clearChatHistory: (roomId) => api.post(`/chat/clear/${roomId}`),
  getUnreadCount: () => api.get('/chat/unread-count'),
  getAdminRooms: () => api.get('/chat/admin/rooms'),
  closeAdminRoom: (roomId) => api.delete(`/chat/admin/close/${roomId}`),
};

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  signup: (userData) => api.post('/auth/signup', userData),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
};

export default api;