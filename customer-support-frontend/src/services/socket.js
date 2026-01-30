import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return;

    const token = localStorage.getItem('accessToken');
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.setupListeners();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      toast.success('Connected to chat');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      toast.error('Disconnected from chat');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      toast.error('Connection error: ' + error.message);
    });

    // Message events
    this.socket.on('receive_message', (data) => {
      this.emitToListeners('receive_message', data);
    });

    this.socket.on('user_typing', (data) => {
      this.emitToListeners('user_typing', data);
    });

    this.socket.on('message_sent', (data) => {
      this.emitToListeners('message_sent', data);
    });

    this.socket.on('message_read', (data) => {
      this.emitToListeners('message_read', data);
    });

    this.socket.on('admin_online', (data) => {
      this.emitToListeners('admin_online', data);
    });

    this.socket.on('customer_connected', (data) => {
      this.emitToListeners('customer_connected', data);
    });
  }

  emitToListeners(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  // Client event emitters
  sendMessage(data) {
    this.socket.emit('send_message', data);
  }

  typing(data) {
    this.socket.emit('typing', data);
  }

  markAsRead(data) {
    this.socket.emit('mark_as_read', data);
  }

  clearChat() {
    this.socket.emit('clear_chat');
  }

  joinRoom(roomId) {
    this.socket.emit('join_room', roomId);
  }

  // Listener management
  on(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.push(callback);
    this.listeners.set(event, callbacks);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();