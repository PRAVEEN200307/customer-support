import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { chatAPI } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-hot-toast";
import {
  FiSend,
  FiPaperclip,
  FiSmile,
  FiCheck,
  FiCheckCircle,
  FiUsers,
  FiX,
  FiSearch,
  FiClock,
  FiMessageSquare,
  FiRefreshCw,
  FiImage,
  FiFile,
  FiDownload,
  FiAlertCircle,
  FiEye,
  FiMaximize,
  FiTrash2
} from "react-icons/fi";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

// Image Viewer Modal Component
const ImageViewerModal = ({ imageUrl, fileName, onClose, onDownload }) => {
  const modalRef = useRef();

  // Close modal on ESC key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [onClose]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
            alt={fileName || "Image preview"}
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
            onClick={() => window.open(imageUrl, "_blank")}
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
  
  const isImage =
    msg.fileType?.startsWith("image/") ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.fileKey || msg.fileName || "");

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
        console.error("Error fetching file URL:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [msg.fileKey]);

  const handleDownload = () => {
    if (!fileUrl) return;
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = msg.fileName || "download";
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
              {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : "File"}
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

const AdminChat = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const [message, setMessage] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  
  const fileInputRef = useRef(null);
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const [isLoadingHistory, setIsLoadingHistory] = useState({});
  const [hasLoadedInitialHistory, setHasLoadedInitialHistory] = useState({});
  const lastFetchTimeRef = useRef({});

  // Main rooms query with caching
  const { data: roomsData, isLoading: isLoadingRooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => {
      try {
        const response = await chatAPI.getAdminRooms();
        return response.data;
      } catch (error) {
        console.error("Error fetching rooms:", error);
        toast.error("Failed to load chat rooms");
        throw error;
      }
    },
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch chat history with deduplication
  const fetchChatHistory = useCallback(async (roomId, limit = 50, offset = 0) => {
    if (!roomId) return [];
    
    const now = Date.now();
    const lastFetch = lastFetchTimeRef.current[roomId];
    if (lastFetch && now - lastFetch < 5000) {
      console.log(`Skipping fetch for room ${roomId}, recent fetch detected`);
      return messages[roomId] || [];
    }

    try {
      setIsLoadingHistory(prev => ({ ...prev, [roomId]: true }));
      
      const response = await chatAPI.getChatHistory(roomId, limit, offset);
      const newMessages = response.data.messages || [];
      
      lastFetchTimeRef.current[roomId] = now;
      
      return newMessages;
    } catch (error) {
      console.error("Error fetching chat history:", error);
      toast.error("Failed to load chat history");
      return messages[roomId] || [];
    } finally {
      setIsLoadingHistory(prev => ({ ...prev, [roomId]: false }));
    }
  }, [messages]);

  // Load initial history when room is selected
  const loadInitialHistory = useCallback(async (roomId) => {
    if (!roomId || hasLoadedInitialHistory[roomId]) return;
    
    try {
      setIsLoadingHistory(prev => ({ ...prev, [roomId]: true }));
      const history = await fetchChatHistory(roomId, 50, 0);
      
      setMessages(prev => {
        const existingMessages = prev[roomId] || [];
        const allMessages = [...existingMessages];
        history.forEach(newMsg => {
          if (!allMessages.some(msg => msg.id === newMsg.id)) {
            allMessages.push(newMsg);
          }
        });
        
        allMessages.sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
        
        return {
          ...prev,
          [roomId]: allMessages,
        };
      });
      
      setHasLoadedInitialHistory(prev => ({ ...prev, [roomId]: true }));
    } catch (error) {
      console.error("Error loading initial history:", error);
    } finally {
      setIsLoadingHistory(prev => ({ ...prev, [roomId]: false }));
    }
  }, [fetchChatHistory, hasLoadedInitialHistory]);

  // Correctly extract rooms from the response
  const rooms = roomsData?.rooms || [];
  const selectedRoomData = rooms.find((r) => r.id === selectedRoom);
  const currentMessages = messages[selectedRoom] || [];
  const currentTypingUser = typingUsers[selectedRoom];

  // Auto-select room from URL or first active room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) {
      if (roomId) {
        const room = rooms.find((r) => r.id === roomId);
        if (room) {
          setSelectedRoom(room.id);
        }
      } else {
        const activeRoom = rooms.find((r) => r.isActive) || rooms[0];
        if (activeRoom) {
          setSelectedRoom(activeRoom.id);
        }
      }
    }
  }, [rooms, roomId, selectedRoom]);

  // Load initial history when room is selected
  useEffect(() => {
    if (selectedRoom && !hasLoadedInitialHistory[selectedRoom]) {
      loadInitialHistory(selectedRoom);
    }
  }, [selectedRoom, loadInitialHistory, hasLoadedInitialHistory]);

  // Join socket room when room is selected
  useEffect(() => {
    if (socket && selectedRoom) {
      socket.emit("join_room", selectedRoom);
    }
  }, [socket, selectedRoom]);

  // Handle switching rooms - clear typing indicator
  useEffect(() => {
    if (socket && selectedRoom) {
      Object.keys(typingUsers).forEach(roomId => {
        if (typingUsers[roomId] && roomId !== selectedRoom) {
          socket.emit("typing", {
            roomId,
            isTyping: false,
          });
        }
      });
    }
  }, [selectedRoom, socket]);

  // WebSocket event handlers for room updates
  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = () => {
      setTimeout(() => {
        queryClient.invalidateQueries(["admin-rooms"]);
      }, 100);
    };

    socket.on("customer_connected", handleRoomUpdate);
    socket.on("room_closed", handleRoomUpdate);

    return () => {
      socket.off("customer_connected", handleRoomUpdate);
      socket.off("room_closed", handleRoomUpdate);
    };
  }, [socket, queryClient]);

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
    const link = document.createElement("a");
    link.href = selectedImage.url;
    link.download = selectedImage.fileName || "image";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid file type (image, PDF, Word, or text)");
      return;
    }

    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
    
    // Clear file input
    e.target.value = "";
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
  };

  // Upload and send file
  const uploadAndSendFile = async (file) => {
    if (!socket || !selectedRoom || !selectedRoomData?.isActive) {
      toast.error("Cannot send file. Chat room is not active.");
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await chatAPI.uploadFile(formData);
      const uploadResult = response.data;
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message || "Upload failed");
      }
      
      // Generate optimistic message
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const optimisticMessage = {
        id: tempId,
        roomId: selectedRoom,
        senderId: user?.id,
        senderEmail: user?.email,
        receiverId: selectedRoomData.customerId,
        message: `File: ${file.name}`,
        messageType: "file",
        fileKey: uploadResult.fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isRead: true,
        createdAt: new Date().toISOString(),
        isOptimistic: true
      };

      // Add optimistic message
      setMessages(prev => {
        const roomMessages = prev[selectedRoom] || [];
        const newMessages = [...roomMessages, optimisticMessage];
        
        newMessages.sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );
        
        return {
          ...prev,
          [selectedRoom]: newMessages,
        };
      });

      // Send via socket
      socket.emit("send_message", {
        roomId: selectedRoom,
        message: `File: ${file.name}`,
        messageType: "file",
        fileKey: uploadResult.fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        receiverId: selectedRoomData.customerId,
        tempId,
      }, (ack) => {
        if (ack?.success) {
          console.log("File message sent successfully");
          
          // Update the optimistic message with the real ID
          if (ack.messageId) {
            setMessages(prev => {
              const roomMessages = prev[selectedRoom] || [];
              const updatedMessages = roomMessages.map(msg =>
                msg.id === tempId ? { ...msg, id: ack.messageId, isOptimistic: false } : msg
              );

              return {
                ...prev,
                [selectedRoom]: updatedMessages,
              };
            });
          }
        } else {
          // Remove optimistic message on error
          setMessages(prev => {
            const roomMessages = prev[selectedRoom] || [];
            const filteredMessages = roomMessages.filter(
              (msg) => msg.id !== tempId
            );

            return {
              ...prev,
              [selectedRoom]: filteredMessages,
            };
          });

          toast.error(ack?.error || "Failed to send file");
        }
      });

      // Clear file selection
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl("");
      }
      
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  // Send message with optimistic update
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!socket || !selectedRoom || !selectedRoomData?.isActive) {
      return;
    }

    // Handle file upload
    if (selectedFile) {
      await uploadAndSendFile(selectedFile);
      return;
    }

    // Handle text message
    if (!message.trim()) {
      return;
    }

    const messageData = {
      roomId: selectedRoom,
      message: message.trim(),
      messageType: "text",
      receiverId: selectedRoomData.customerId,
    };

    // Generate a unique ID for the optimistic message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      id: tempId,
      roomId: selectedRoom,
      senderId: user?.id,
      senderEmail: user?.email,
      receiverId: selectedRoomData.customerId,
      message: message.trim(),
      messageType: "text",
      isRead: true,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Add optimistic message
    setMessages((prev) => {
      const roomMessages = prev[selectedRoom] || [];
      const newMessages = [...roomMessages, optimisticMessage];

      newMessages.sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      );

      return {
        ...prev,
        [selectedRoom]: newMessages,
      };
    });

    // Clear input
    setMessage("");

    // Send via socket with callback
    socket.emit("send_message", { ...messageData, tempId }, (ack) => {
      if (ack?.success) {
        console.log("Message sent successfully");
        
        // If the server doesn't send back the message via socket, update the optimistic message
        if (ack.messageId) {
          setMessages((prev) => {
            const roomMessages = prev[selectedRoom] || [];
            const updatedMessages = roomMessages.map((msg) =>
              msg.id === tempId ? { ...msg, id: ack.messageId, isOptimistic: false } : msg
            );

            return {
              ...prev,
              [selectedRoom]: updatedMessages,
            };
          });
        }
      } else {
        // Remove optimistic message on error
        setMessages((prev) => {
          const roomMessages = prev[selectedRoom] || [];
          const filteredMessages = roomMessages.filter(
            (msg) => msg.id !== tempId
          );

          return {
            ...prev,
            [selectedRoom]: filteredMessages,
          };
        });

        toast.error(ack?.error || "Failed to send message");
        setMessage(messageData.message); // Restore the message
      }
    });
  };

  // Socket event handlers for messages
  useEffect(() => {
    if (!socket) return;

    // Join admin room globally
    socket.emit("join_admin_room");

    // Handle new message
    const handleReceiveMessage = (data) => {
      console.log("New message received:", data);

      // Ensure the message has createdAt field
      const messageWithTimestamp = {
        ...data,
        createdAt: data.createdAt || data.created_at || new Date().toISOString(),
        isRead: data.isRead || data.senderId === user?.id,
      };

      setMessages((prev) => {
        const roomMessages = prev[data.roomId] || [];
        
        // Check if message already exists
        const existingIndex = roomMessages.findIndex(
          msg => msg.id === data.id || (msg.isOptimistic && msg.message === data.message && msg.senderId === data.senderId)
        );

        let newRoomMessages;
        if (existingIndex !== -1) {
          // Replace existing message
          newRoomMessages = [...roomMessages];
          newRoomMessages[existingIndex] = messageWithTimestamp;
        } else {
          // Add new message
          newRoomMessages = [...roomMessages, messageWithTimestamp];
        }

        // Remove any other optimistic messages with same content
        newRoomMessages = newRoomMessages.filter((msg, index) => {
          if (!msg.isOptimistic) return true;
          if (index === existingIndex) return false;
          
          return !(
            msg.senderId === data.senderId && 
            msg.message === data.message &&
            Math.abs(new Date(msg.createdAt || 0) - new Date(messageWithTimestamp.createdAt || 0)) < 2000
          );
        });

        // Sort by timestamp
        newRoomMessages.sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

        return {
          ...prev,
          [data.roomId]: newRoomMessages,
        };
      });

      // Show notification if not in current room
      if (data.roomId !== selectedRoom) {
        const room = rooms.find((r) => r.id === data.roomId);
        if (room) {
          toast.custom(
            (t) => (
              <div
                className={`${t.visible ? "animate-enter" : "animate-leave"} 
                max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
              >
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      <FiMessageSquare className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        New message from {room.customer?.email || "Customer"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 truncate">
                        {data.messageType === "file" 
                          ? "📎 Shared a file" 
                          : data.message.length > 50
                            ? `${data.message.substring(0, 50)}...`
                            : data.message}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-gray-200">
                  <button
                    onClick={() => {
                      setSelectedRoom(data.roomId);
                      toast.dismiss(t.id);
                    }}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Open
                  </button>
                </div>
              </div>
            ),
            {
              duration: 5000,
            }
          );
        }
      }
    };

    // Handle typing indicator
    const handleUserTyping = (data) => {
      if (data.isTyping) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.roomId]: data.userId,
        }));

        // Clear typing indicator after 2 seconds
        if (typingTimeoutRef.current[data.roomId]) {
          clearTimeout(typingTimeoutRef.current[data.roomId]);
        }

        typingTimeoutRef.current[data.roomId] = setTimeout(() => {
          setTypingUsers((prev) => ({
            ...prev,
            [data.roomId]: null,
          }));
        }, 2000);
      } else {
        setTypingUsers((prev) => ({
          ...prev,
          [data.roomId]: null,
        }));
      }
    };

    // Handle message read confirmation
    const handleMessageRead = (data) => {
      setMessages((prev) => {
        const roomMessages = prev[data.roomId] || [];
        const updatedMessages = roomMessages.map((msg) =>
          data.messageIds.includes(msg.id)
            ? {
                ...msg,
                isRead: true,
                readAt: data.readAt || new Date().toISOString(),
              }
            : msg
        );

        return {
          ...prev,
          [data.roomId]: updatedMessages,
        };
      });
    };

    // Handle room closed
    const handleRoomClosed = (data) => {
      if (data.roomId === selectedRoom) {
        toast.info("Chat room has been closed");
        setSelectedRoom(null);
      }
      // Invalidate rooms query after a delay
      setTimeout(() => {
        queryClient.invalidateQueries(["admin-rooms"]);
      }, 100);
    };

    // Handle customer connected
    const handleCustomerConnected = (data) => {
      // Invalidate rooms query after a delay
      setTimeout(() => {
        queryClient.invalidateQueries(["admin-rooms"]);
      }, 100);
      toast.success(`New customer connected: ${data.customerEmail}`);
    };

    // Handle message sent confirmation
    const handleMessageSent = (data) => {
      console.log("Message sent confirmation:", data);
      
      // Update the optimistic message with the real ID
      if (data.tempId && data.messageId) {
        setMessages(prev => {
          const roomMessages = prev[data.roomId] || [];
          const updatedMessages = roomMessages.map(msg => 
            msg.id === data.tempId ? { ...msg, id: data.messageId, isOptimistic: false } : msg
          );
          
          return {
            ...prev,
            [data.roomId]: updatedMessages,
          };
        });
      }
    };

    // Attach event listeners
    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("message_read", handleMessageRead);
    socket.on("room_closed", handleRoomClosed);
    socket.on("customer_connected", handleCustomerConnected);
    socket.on("message_sent", handleMessageSent);

    return () => {
      // Remove event listeners
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("message_read", handleMessageRead);
      socket.off("room_closed", handleRoomClosed);
      socket.off("customer_connected", handleCustomerConnected);
      socket.off("message_sent", handleMessageSent);

      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
    };
  }, [socket, selectedRoom, queryClient, rooms, user?.id]);

  // Handle typing indicator
  useEffect(() => {
    if (!socket || !selectedRoom) return;

    let typingTimeout;

    const emitTyping = () => {
      if (message.trim()) {
        socket.emit("typing", {
          roomId: selectedRoom,
          isTyping: true,
        });

        // Clear typing after 1 second of inactivity
        typingTimeout = setTimeout(() => {
          socket.emit("typing", {
            roomId: selectedRoom,
            isTyping: false,
          });
        }, 1000);
      } else {
        socket.emit("typing", {
          roomId: selectedRoom,
          isTyping: false,
        });
      }
    };

    const debouncedTyping = setTimeout(emitTyping, 300);

    return () => {
      clearTimeout(debouncedTyping);
      clearTimeout(typingTimeout);
    };
  }, [message, socket, selectedRoom]);

  // Mark messages as read when opening a chat
  useEffect(() => {
    if (!socket || !selectedRoom || currentMessages.length === 0) return;

    const unreadMessages = currentMessages.filter(
      (msg) => !msg.isRead && msg.senderId !== user?.id
    );

    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map((msg) => msg.id);

      // Update local state immediately
      setMessages((prev) => {
        const roomMessages = prev[selectedRoom] || [];
        const updatedMessages = roomMessages.map((msg) =>
          messageIds.includes(msg.id) ? { ...msg, isRead: true } : msg
        );

        return {
          ...prev,
          [selectedRoom]: updatedMessages,
        };
      });

      // Send to server
      socket.emit("mark_as_read", {
        messageIds,
        roomId: selectedRoom,
      });
    }
  }, [socket, selectedRoom, currentMessages, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Close room
  const handleCloseRoom = () => {
    if (selectedRoom && window.confirm("Are you sure you want to close this chat?")) {
      socket.emit("close_room", selectedRoom, (ack) => {
        if (ack?.success) {
          toast.success("Chat room closed");
          queryClient.invalidateQueries(["admin-rooms"]);
          setSelectedRoom(null);
        } else {
          toast.error(ack?.error || "Failed to close room");
        }
      });
    }
  };

  // Manual refresh rooms
  const handleRefreshRooms = () => {
    queryClient.invalidateQueries(["admin-rooms"]);
    toast.success("Rooms refreshed");
  };

  // Load more messages
  const handleLoadMore = async () => {
    if (!selectedRoom || isLoadingHistory[selectedRoom]) return;
    
    const currentRoomMessages = messages[selectedRoom] || [];
    const oldestMessage = currentRoomMessages[0];
    
    if (!oldestMessage) return;
    
    try {
      setIsLoadingHistory(prev => ({ ...prev, [selectedRoom]: true }));
      const olderMessages = await fetchChatHistory(selectedRoom, 50, currentRoomMessages.length);
      
      if (olderMessages.length > 0) {
        setMessages(prev => {
          const existingMessages = prev[selectedRoom] || [];
          const allMessages = [...olderMessages, ...existingMessages];
          
          // Remove duplicates
          const uniqueMessages = allMessages.reduce((acc, msg) => {
            if (!acc.some(m => m.id === msg.id)) {
              acc.push(msg);
            }
            return acc;
          }, []);
          
          // Sort by timestamp
          uniqueMessages.sort(
            (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
          );
          
          return {
            ...prev,
            [selectedRoom]: uniqueMessages,
          };
        });
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setIsLoadingHistory(prev => ({ ...prev, [selectedRoom]: false }));
    }
  };

  // Filter rooms based on search term
  const filteredRooms = searchTerm
    ? rooms.filter(
        (room) =>
          (room.customer?.email?.toLowerCase() || "").includes(
            searchTerm.toLowerCase()
          ) ||
          (room.roomName?.toLowerCase() || "").includes(
            searchTerm.toLowerCase()
          )
      )
    : rooms;

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = {};

    messages.forEach((msg) => {
      const timestamp = msg.createdAt || msg.created_at;
      if (!timestamp) return;

      const date = new Date(timestamp);
      let dateKey;

      if (isToday(date)) {
        dateKey = "Today";
      } else if (isYesterday(date)) {
        dateKey = "Yesterday";
      } else {
        dateKey = format(date, "MMMM dd, yyyy");
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });

    return groups;
  };

  // Filter out duplicate optimistic messages
  const getDisplayMessages = () => {
    const roomMessages = currentMessages || [];
    
    return roomMessages.filter((msg, index, array) => {
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
  const messageGroups = groupMessagesByDate(displayMessages);

  const formatLastSeen = (dateValue) => {
    if (!dateValue) return "No messages";

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return "No messages";

    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Render message content based on type
  const renderMessageContent = (msg) => {
    if (msg.messageType === "file") {
      return <FileMessage msg={msg} onImageClick={handleImageClick} />;
    }

    return (
      <div className="text-sm whitespace-pre-wrap break-words pb-1">
        {msg.message}
      </div>
    );
  };

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

      <div className="flex h-[calc(100vh-12rem)] bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Sidebar - Chat Rooms List */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Active Chats
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleRefreshRooms}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Refresh rooms"
                >
                  <FiRefreshCw className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                </button>
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                  {rooms.length || 0}
                </span>
              </div>
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
              <div className="p-4 text-center text-gray-500">
                Loading chats...
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm ? "No chats found" : "No active chats"}
              </div>
            ) : (
              filteredRooms.map((room) => {
                const roomMessages = messages[room.id] || [];
                const unreadCount = roomMessages.filter(
                  (msg) => !msg.isRead && msg.senderId !== user?.id
                ).length;
                const lastMessage =
                  roomMessages.length > 0
                    ? roomMessages[roomMessages.length - 1]
                    : null;

                return (
                  <div
                    key={room.id}
                    onClick={() => setSelectedRoom(room.id)}
                    className={`p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 ${
                      selectedRoom === room.id
                        ? "bg-blue-50 border-l-4 border-l-blue-500"
                        : room.isActive
                        ? "bg-green-50"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            room.isActive ? "bg-green-100" : "bg-gray-100"
                          }`}
                        >
                          <span
                            className={`font-semibold ${
                              room.isActive ? "text-green-600" : "text-gray-600"
                            }`}
                          >
                            {room.customer?.email?.charAt(0)?.toUpperCase() ||
                              "U"}
                          </span>
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {room.customer?.email || "Unknown User"}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <FiClock className="w-3 h-3 mr-1" />
                            {lastMessage?.createdAt
                              ? formatLastSeen(lastMessage.createdAt)
                              : formatLastSeen(room?.lastMessageAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mb-1">
                            {unreadCount}
                          </span>
                        )}
                        <div className="flex items-center space-x-1">
                          {room.isActive ? (
                            <span className="text-xs text-green-600 font-medium">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Closed</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {lastMessage && (
                      <p className="text-xs text-gray-600 truncate mt-2 ml-13">
                        {lastMessage.messageType === "file" 
                          ? `📎 ${lastMessage.fileName || "File"}`
                          : lastMessage.message}
                      </p>
                    )}
                  </div>
                );
              })
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
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selectedRoomData?.isActive
                          ? "bg-green-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <span
                        className={`text-lg font-semibold ${
                          selectedRoomData?.isActive
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}
                      >
                        {selectedRoomData?.customer?.email
                          ?.charAt(0)
                          ?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {selectedRoomData?.customer?.email || "Unknown User"}
                        {currentTypingUser && (
                          <span className="ml-2 text-sm font-normal text-blue-600 animate-pulse">
                            typing...
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center space-x-3 text-sm text-gray-500">
                        <span className="flex items-center">
                          <div
                            className={`w-2 h-2 rounded-full mr-2 ${
                              selectedRoomData?.isActive
                                ? "bg-green-500 animate-pulse"
                                : "bg-gray-400"
                            }`}
                          ></div>
                          {selectedRoomData?.isActive
                            ? "Online • Active"
                            : "Offline • Closed"}
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">
                          Room:{" "}
                          {selectedRoomData?.roomName?.slice(-8) ||
                            selectedRoomData?.id?.slice(-8)}
                        </span>
                        <span>•</span>
                        <span>
                          Created:{" "}
                          {selectedRoomData?.created_at
                            ? format(
                                new Date(selectedRoomData.created_at),
                                "MMM dd"
                              )
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {!selectedRoomData?.isActive ? (
                      <button
                        onClick={() =>
                          toast.info("This chat room is already closed")
                        }
                        className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Room Closed
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseRoom}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Close Chat
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

              {/* File Preview (if any) */}
              {selectedFile && (
                <div className="bg-blue-50 p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {previewUrl ? (
                        <div 
                          className="w-12 h-12 rounded overflow-hidden cursor-pointer"
                          onClick={() => setSelectedImage({ url: previewUrl, fileName: selectedFile.name })}
                        >
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                          <FiFile className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleRemoveFile}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove file"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {isLoadingHistory[selectedRoom] && displayMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-500">Loading messages...</div>
                  </div>
                ) : displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                      <FiUsers className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No messages yet</h3>
                    <p className="text-sm text-center max-w-md">
                      Start the conversation by sending a message to the customer.
                      All messages are delivered in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Load More Button */}
                    {displayMessages.length >= 50 && (
                      <div className="sticky top-0 z-20 flex justify-center mb-4">
                        <button
                          onClick={handleLoadMore}
                          disabled={isLoadingHistory[selectedRoom]}
                          className="bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-full hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoadingHistory[selectedRoom] ? "Loading..." : "Load older messages"}
                        </button>
                      </div>
                    )}
                    
                    {Object.entries(messageGroups).map(([date, dateMessages]) => (
                      <div key={date}>
                        <div className="sticky top-10 z-10 flex justify-center mb-4">
                          <div className="bg-blue-100 text-blue-800 text-xs font-medium px-4 py-2 rounded-full">
                            {date}
                          </div>
                        </div>
                        <div className="space-y-1">
                          {dateMessages.map((msg) => {
                            const isSender = msg.senderId === user?.id;
                            const isRead = msg.isRead;
                            const isOptimistic = msg.isOptimistic;
                            const timestamp = msg.createdAt
                              ? new Date(msg.createdAt)
                              : msg.created_at
                              ? new Date(msg.created_at)
                              : null;

                            return (
                              <div
                                key={msg.id}
                                className={`flex ${
                                  isSender ? "justify-end" : "justify-start"
                                } mb-1 px-4`}
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
                                  {renderMessageContent(msg)}

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
                                              {msg.messageType === 'file' ? 'Uploading...' : 'Sending...'}
                                            </span>
                                          </div>
                                        ) : (
                                          <>
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
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center space-x-3"
                >
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                          selectedRoomData?.isActive
                            ? "Type your message..."
                            : "This chat room is closed"
                        }
                        disabled={!selectedRoomData?.isActive}
                        className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if ((message.trim() || selectedFile) && selectedRoomData?.isActive) {
                              handleSendMessage(e);
                            }
                          }
                        }}
                      />
                      <div className="absolute right-3 top-3 flex items-center space-x-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.txt"
                          disabled={!selectedRoomData?.isActive || uploading}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors disabled:hover:text-gray-500 disabled:cursor-not-allowed"
                          disabled={!selectedRoomData?.isActive || uploading}
                          title="Attach file"
                        >
                          <FiPaperclip className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors disabled:hover:text-gray-500"
                          disabled={!selectedRoomData?.isActive}
                        >
                          <FiSmile className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={(!message.trim() && !selectedFile) || !selectedRoomData?.isActive || uploading}
                    className="bg-blue-600 text-white p-3.5 rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <FiSend className="w-5 h-5" />
                    )}
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
                Select a conversation from the sidebar to start real-time chatting
                with customers. All messages are delivered instantly via
                WebSocket.
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
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                  <span>Real-time Updates</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                  <span>Typing Indicators</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminChat;