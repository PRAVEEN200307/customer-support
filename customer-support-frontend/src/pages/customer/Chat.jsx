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
  FiAlertCircle,
  FiImage,
  FiFile,
  FiX,
  FiDownload,
  FiMessageCircle,
  FiMinimize2,
  FiMaximize2,
  FiXCircle,
  FiEye,
  FiMaximize
} from 'react-icons/fi';
import { format, isToday, isYesterday } from 'date-fns';

// Image Viewer Modal Component
const ImageViewerModal = ({ imageUrl, fileName, onClose, onDownload }) => {
  const modalRef = useRef();

  // Close modal on ESC key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [onClose]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div 
        ref={modalRef}
        className="relative max-w-4xl max-h-[90vh] w-full bg-transparent rounded-lg overflow-hidden"
      >
        {/* Image Container */}
        <div className="flex items-center justify-center h-full">
          <img
            src={imageUrl}
            alt={fileName || 'Image preview'}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>

        {/* Action Buttons - Top Right */}
        <div className="absolute top-4 right-4 flex items-center space-x-2">
          <button
            onClick={onDownload}
            className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-black rounded-full transition-all duration-200 hover:scale-105"
            title="Download"
          >
            <FiDownload className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-black rounded-full transition-all duration-200 hover:scale-105"
            title="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Image Info - Bottom Center */}
        {fileName && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full">
              <p className="text-white text-sm font-medium truncate max-w-xs">
                {fileName}
              </p>
            </div>
          </div>
        )}

        {/* Open Full Size Button - Bottom Right */}
        <div className="absolute bottom-4 right-4">
          <button
            onClick={() => window.open(imageUrl, '_blank')}
            className="p-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full transition-all duration-200 hover:scale-105 flex items-center space-x-2"
            title="Open in new tab"
          >
            <FiMaximize className="w-5 h-5" />
            <span className="text-sm">Open Full Size</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const FileMessage = ({ msg, onImageClick }) => {
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const isImage = msg.fileType?.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.fileKey || msg.fileName || '');

  useEffect(() => {
    const fetchUrl = async () => {
      if (!msg.fileKey) return;
      try {
        setLoading(true);
        const response = await chatAPI.getFileUrl(msg.fileKey);
        if (response.data.success) {
          setFileUrl(response.data.url);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching file URL:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [msg.fileKey]);

  const handleDownload = () => {
    if (!fileUrl) return;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = msg.fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImageClick = () => {
    if (isImage && fileUrl && onImageClick) {
      onImageClick({
        url: fileUrl,
        fileName: msg.fileName,
        fileType: msg.fileType
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-gray-100 rounded-lg animate-pulse">
        <FiClock className="w-5 h-5 text-gray-400" />
        <span className="text-sm text-gray-500">Loading file...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg text-red-600">
        <FiAlertCircle className="w-5 h-5" />
        <span className="text-sm">Failed to load file</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isImage && fileUrl ? (
        <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
          {/* Image Preview */}
          <div 
            className="cursor-pointer hover:opacity-95 transition-opacity"
            onClick={handleImageClick}
          >
            <img
              src={fileUrl}
              alt={msg.fileName}
              className="max-w-full h-auto max-h-60 object-contain"
            />
          </div>
          
          {/* Action Buttons */}
          <div className="absolute bottom-2 right-2 flex items-center space-x-2">
            <button
              onClick={handleImageClick}
              className="p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              title="View full image"
            >
              <FiEye className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              title="Download"
            >
              <FiDownload className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg border border-gray-200/50">
          <div className="p-2 bg-blue-100 rounded-lg">
            {isImage ? (
              <FiImage className="w-6 h-6 text-blue-600" />
            ) : (
              <FiFile className="w-6 h-6 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {msg.fileName}
            </p>
            <p className="text-xs text-gray-500">
              {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'File'}
            </p>
          </div>
          <button
            onClick={handleDownload}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Download"
          >
            <FiDownload className="w-5 h-5" />
          </button>
        </div>
      )}
      {msg.message && msg.message !== `File: ${msg.fileName}` && (
        <p className="text-sm text-gray-800 whitespace-pre-wrap px-1">
          {msg.message}
        </p>
      )}
    </div>
  );
};

const CustomerChat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const fileInputRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch or create customer's room
  const { data: roomData, isLoading: roomLoading } = useQuery({
    queryKey: ['my-room'],
    queryFn: () => chatAPI.getMyRoom(),
    staleTime: 30000,
  });

  const roomId = roomData?.data?.room?.id;

  // Fetch initial chat history
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

  // Join socket room
  useEffect(() => {
    if (socket && roomId) {
      socket.emit('join_room', roomId);
    }
  }, [socket, roomId]);

  // Setup WebSocket event handlers
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleReceiveMessage = (data) => {
      if (data.roomId !== roomId) return;

      const messageWithTimestamp = {
        ...data,
        createdAt: data.createdAt || data.created_at || new Date().toISOString()
      };

      setMessages(prev => {
        if (prev.some(msg => msg.id === data.id)) return prev;

        const isOurOwnMessage = data.senderId === user?.id;
        if (isOurOwnMessage) {
          const optimisticIndex = prev.findIndex(
            msg => msg.isOptimistic && msg.message === data.message
          );
          
          if (optimisticIndex !== -1) {
            const newMessages = [...prev];
            newMessages[optimisticIndex] = messageWithTimestamp;
            newMessages.sort((a, b) => 
              new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );
            return newMessages;
          }
        }

        const newMessages = [...prev, messageWithTimestamp];
        newMessages.sort((a, b) => 
          new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
        
        return newMessages;
      });

      // Increase unread count if chat is closed or minimized
      if (data.senderId !== user?.id) {
        if (!isChatOpen || isMinimized) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    const handleUserTyping = (data) => {
      if (data.roomId === roomId && data.userId !== user?.id) {
        setTyping(data.isTyping);
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
          }, 2000);
        }
      }
    };

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

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_read', handleMessageRead);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_read', handleMessageRead);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, roomId, user?.id, isChatOpen, isMinimized]);

  // Handle image click in FileMessage component
  const handleImageClick = (imageData) => {
    setSelectedImage(imageData);
  };

  // Close image viewer
  const handleCloseImageViewer = () => {
    setSelectedImage(null);
  };

  // Download image from viewer
  const handleDownloadImage = () => {
    if (!selectedImage?.url) return;
    const link = document.createElement('a');
    link.href = selectedImage.url;
    link.download = selectedImage.fileName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid file type (image, PDF, Word, or text)');
      return;
    }

    setSelectedFile(file);
    
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl('');
    }
    
    e.target.value = '';
  };

  // Upload and send file
  const uploadAndSendFile = async (file) => {
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await chatAPI.uploadFile(formData);
      const uploadResult = response.data;
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message || 'Upload failed');
      }
      
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const optimisticMessage = {
        id: tempId,
        roomId,
        senderId: user?.id,
        senderEmail: user?.email,
        receiverId: null,
        message: `File: ${file.name}`,
        messageType: 'file',
        fileKey: uploadResult.fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isRead: false,
        createdAt: new Date().toISOString(),
        isOptimistic: true
      };

      setMessages(prev => {
        const newMessages = [...prev, optimisticMessage];
        newMessages.sort((a, b) => 
          new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
        return newMessages;
      });

      socket.emit('send_message', {
        roomId,
        message: `File: ${file.name}`,
        messageType: 'file',
        fileKey: uploadResult.fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        receiverId: null,
      }, (ack) => {
        if (!ack?.success) {
          setMessages(prev => 
            prev.filter(msg => msg.id !== tempId)
          );
          toast.error(ack?.error || 'Failed to send file');
        }
      });

      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
      
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!socket || !roomId) return;

    if (selectedFile) {
      await uploadAndSendFile(selectedFile);
      return;
    }

    if (!message.trim()) return;

    const messageData = {
      roomId,
      message: message.trim(),
      messageType: 'text',
      receiverId: null,
    };

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

    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage];
      newMessages.sort((a, b) => 
        new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      );
      return newMessages;
    });

    socket.emit('send_message', messageData, (ack) => {
      if (!ack?.success) {
        setMessages(prev => 
          prev.filter(msg => msg.id !== tempId)
        );
        toast.error(ack?.error || 'Failed to send message');
      }
    });

    setMessage('');
  };

  // Toggle chat window
  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    setIsMinimized(false);
    if (!isChatOpen) {
      setUnreadCount(0);
    }
  };

  // Minimize chat window
  const minimizeChat = () => {
    setIsMinimized(true);
  };

  // Maximize chat window
  const maximizeChat = () => {
    setIsMinimized(false);
  };

  // Close chat window
  const closeChat = () => {
    setIsChatOpen(false);
    setIsMinimized(false);
  };

  // Get display messages
  const getDisplayMessages = () => {
    return messages.filter((msg, index, array) => {
      if (!msg.isOptimistic) return true;
      
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

  // Render message content
  const renderMessageContent = (msg) => {
    if (msg.messageType === 'file') {
      return <FileMessage msg={msg} onImageClick={handleImageClick} />;
    }

    return (
      <div className="text-sm whitespace-pre-wrap break-words">
        {msg.message}
      </div>
    );
  };

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Connecting to chat...</span>
      </div>
    );
  }

  return (
    <>
      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewerModal
          imageUrl={selectedImage.url}
          fileName={selectedImage.fileName}
          onClose={handleCloseImageViewer}
          onDownload={handleDownloadImage}
        />
      )}

      {/* Floating Contact Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-all duration-300 hover:scale-110 flex items-center justify-center"
      >
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <FiMessageCircle className="w-7 h-7" />
      </button>

      {/* Chat Window */}
      {isChatOpen && (
        <div className={`fixed bottom-24 right-6 z-40 ${isMinimized ? 'w-72' : 'w-80 sm:w-96'} transition-all duration-300`}>
          {/* Chat Header */}
          <div className="bg-blue-600 text-white rounded-t-xl p-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <FiUser className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Support Chat</h3>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs opacity-90">Online</span>
                  {typing && (
                    <span className="text-xs animate-pulse ml-2">typing...</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={isMinimized ? maximizeChat : minimizeChat}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? (
                  <FiMaximize2 className="w-4 h-4" />
                ) : (
                  <FiMinimize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={closeChat}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                title="Close"
              >
                <FiXCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body - Only show when not minimized */}
          {!isMinimized && (
            <>
              {/* Chat Messages */}
              <div className="bg-white h-80 overflow-y-auto p-3 border-l border-r border-gray-200">
                {displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4 text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                      <FiMessageSquare className="w-6 h-6 text-blue-600" />
                    </div>
                    <h4 className="font-medium text-gray-800 mb-1">Start a conversation</h4>
                    <p className="text-xs text-gray-600">
                      Send a message to get help from our support team
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayMessages.slice(-20).map((msg) => {
                      const isSender = msg.senderId === user?.id;
                      const isOptimistic = msg.isOptimistic;
                      const timestamp = msg.createdAt ? new Date(msg.createdAt) : null;

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-3 py-2 ${
                              isSender
                                ? isOptimistic
                                  ? "bg-blue-100 opacity-70"
                                  : "bg-blue-500 text-white"
                                : "bg-gray-100"
                            }`}
                          >
                            {msg.messageType === 'file' ? (
                              <FileMessage msg={msg} onImageClick={handleImageClick} />
                            ) : (
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {msg.message}
                              </div>
                            )}
                            {timestamp && (
                              <div className="text-xs mt-1 opacity-70">
                                {format(timestamp, 'HH:mm')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* File preview (if any) */}
              {selectedFile && (
                <div className="bg-blue-50 p-2 border-l border-r border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {previewUrl ? (
                        <div className="w-8 h-8 rounded overflow-hidden cursor-pointer" onClick={() => setSelectedImage({ url: previewUrl, fileName: selectedFile.name })}>
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <FiFile className="w-4 h-4 text-blue-600" />
                        </div>
                      )}
                      <div className="truncate max-w-[180px]">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {selectedFile.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl);
                          setPreviewUrl('');
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="bg-white border border-gray-200 rounded-b-xl p-3 shadow-lg">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (message.trim() || selectedFile) {
                              handleSendMessage(e);
                            }
                          }
                        }}
                        disabled={uploading}
                      />
                      <div className="absolute right-2 top-2 flex items-center space-x-1">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.txt"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          disabled={uploading}
                        >
                          <FiPaperclip className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={(!message.trim() && !selectedFile) || uploading}
                    className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <FiSend className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default CustomerChat;