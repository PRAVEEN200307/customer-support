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
} from "react-icons/fi";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

const AdminChat = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");
  const [message, setMessage] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [messages, setMessages] = useState({}); // roomId -> messages array
  const [typingUsers, setTypingUsers] = useState({}); // roomId -> userId
  const { socket } = useSocket();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef({});
  const [isLoadingHistory, setIsLoadingHistory] = useState({}); // Track loading state per room
  const [hasLoadedInitialHistory, setHasLoadedInitialHistory] = useState({}); // Track if initial history loaded
  const lastFetchTimeRef = useRef({}); // Track last fetch time per room

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
    staleTime: 60000, // Data is fresh for 60 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Fetch chat history with deduplication
  const fetchChatHistory = useCallback(async (roomId, limit = 50, offset = 0) => {
    if (!roomId) return [];
    
    // Check if we recently fetched for this room
    const now = Date.now();
    const lastFetch = lastFetchTimeRef.current[roomId];
    if (lastFetch && now - lastFetch < 5000) { // 5 second cooldown
      console.log(`Skipping fetch for room ${roomId}, recent fetch detected`);
      return messages[roomId] || [];
    }

    try {
      setIsLoadingHistory(prev => ({ ...prev, [roomId]: true }));
      
      const response = await chatAPI.getChatHistory(roomId, limit, offset);
      const newMessages = response.data.messages || [];
      
      // Update last fetch time
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
        // Merge and deduplicate messages
        const allMessages = [...existingMessages];
        history.forEach(newMsg => {
          if (!allMessages.some(msg => msg.id === newMsg.id)) {
            allMessages.push(newMsg);
          }
        });
        
        // Sort by timestamp
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
      // Emit that we stopped typing in previous room (if any)
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
      // Use a short delay to batch updates
      setTimeout(() => {
        queryClient.invalidateQueries(["admin-rooms"]);
      }, 100);
    };

    // Only listen to these events for room list updates
    socket.on("customer_connected", handleRoomUpdate);
    socket.on("room_closed", handleRoomUpdate);

    return () => {
      socket.off("customer_connected", handleRoomUpdate);
      socket.off("room_closed", handleRoomUpdate);
    };
  }, [socket, queryClient]);

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
        isRead: data.isRead || data.senderId === user?.id, // Mark our own messages as read
      };

      setMessages((prev) => {
        const roomMessages = prev[data.roomId] || [];
        
        // Check if message already exists (for optimistic updates or duplicates)
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
          
          // Check if this optimistic message is now replaced
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
                        {data.message.length > 50
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

  // Send message with optimistic update
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!socket || !selectedRoom || !message.trim() || !selectedRoomData?.isActive) {
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
      isRead: true, // Our own messages are marked as read immediately
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Add optimistic message
    setMessages((prev) => {
      const roomMessages = prev[selectedRoom] || [];
      const newMessages = [...roomMessages, optimisticMessage];

      // Sort by timestamp
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

  // Load more messages (for pagination/infinite scroll)
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
    
    // Filter out optimistic messages that have been replaced by real ones
    return roomMessages.filter((msg, index, array) => {
      if (!msg.isOptimistic) return true;
      
      // Check if there's a real message with same content from same sender
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

  return (
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
                      {lastMessage.message}
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
                  disabled={!message.trim() || !selectedRoomData?.isActive}
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
  );
};

export default AdminChat;