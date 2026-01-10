// src/pages/admin/Chat.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  FiUser,
  FiAlertCircle,
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


  // Fetch all rooms
  const { data: roomsData, isLoading: isLoadingRooms } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: () => chatAPI.getAdminRooms(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch initial chat history for a room
  const fetchInitialHistory = useCallback(async (roomId) => {
    try {
      if (!roomId) return [];
      const response = await chatAPI.getChatHistory(roomId, 50, 0);
      return response.data.messages || [];
    } catch (error) {
      console.error("Error fetching initial history:", error);
      toast.error("Failed to load chat history");
      return [];
    }
  }, []);

  // Correctly extract rooms from the response
  const rooms = roomsData?.data?.rooms || [];
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
    if (selectedRoom && !messages[selectedRoom]) {
      fetchInitialHistory(selectedRoom).then((initialMessages) => {
        setMessages((prev) => ({
          ...prev,
          [selectedRoom]: initialMessages,
        }));
      });
    }
  }, [selectedRoom, fetchInitialHistory, messages]);

  // Join socket room when room is selected
  useEffect(() => {
    if (socket && selectedRoom) {
      socket.emit("join_room", selectedRoom);
    }
  }, [socket, selectedRoom]);

  // Socket event handlers
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
        createdAt:
          data.createdAt || data.created_at || new Date().toISOString(),
      };

      // Add message to the room's messages
      setMessages((prev) => {
        console.log("Adding message to room:", data.roomId);
        const roomMessages = prev[data.roomId] || [];

        // Check if message already exists
        if (roomMessages.some((msg) => msg.id === data.id)) {
          return prev;
        }

        const newMessages = [...roomMessages, messageWithTimestamp];



        // Sort by timestamp
        newMessages.sort(
          (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
        );

        return {
          ...prev,
          [data.roomId]: newMessages,
        };
      });

      // Update room list
      queryClient.invalidateQueries(["admin-rooms"]);

      // Show notification if not in current room
      if (data.roomId !== selectedRoom) {
        const room = rooms.find((r) => r.id === data.roomId);
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
                      New message from {room?.customer?.email || "Customer"}
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
      queryClient.invalidateQueries(["admin-rooms"]);
    };

    // Handle customer connected
    const handleCustomerConnected = (data) => {
      queryClient.invalidateQueries(["admin-rooms"]);
      toast.success(`New customer connected: ${data.customerEmail}`);
    };

    // Handle customer online status
    const handleCustomerOnline = (data) => {
      queryClient.invalidateQueries(["admin-rooms"]);
    };

    // Attach event listeners
    socket.on("receive_message", handleReceiveMessage);
    socket.on("user_typing", handleUserTyping);
    socket.on("message_read", handleMessageRead);
    socket.on("room_closed", handleRoomClosed);
    socket.on("customer_connected", handleCustomerConnected);
    socket.on("customer_online", handleCustomerOnline);

    return () => {
      // Remove event listeners
      socket.off("receive_message", handleReceiveMessage);
      socket.off("user_typing", handleUserTyping);
      socket.off("message_read", handleMessageRead);
      socket.off("room_closed", handleRoomClosed);
      socket.off("customer_connected", handleCustomerConnected);
      socket.off("customer_online", handleCustomerOnline);

      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
    };
  }, [socket, selectedRoom, queryClient, rooms]);

  // Handle typing indicator
  useEffect(() => {
    if (socket && selectedRoom && message.trim()) {
      socket.emit("typing", {
        roomId: selectedRoom,
        isTyping: true,
      });

      // Clear typing after 1 second of inactivity
      const timeout = setTimeout(() => {
        socket.emit("typing", {
          roomId: selectedRoom,
          isTyping: false,
        });
      }, 1000);

      return () => clearTimeout(timeout);
    }
  }, [message, socket, selectedRoom]);

  // Mark messages as read when opening a chat
  useEffect(() => {
    if (socket && selectedRoom && currentMessages.length > 0) {
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
    }
  }, [socket, selectedRoom, currentMessages.length, user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (
      !socket ||
      !selectedRoom ||
      !message.trim() ||
      !selectedRoomData?.isActive
    ) {
      return;
    }

    const messageData = {
      roomId: selectedRoom,
      message: message.trim(),
      messageType: "text",
      receiverId: selectedRoomData.customerId,
    };


    // Send via socket
    socket.emit("send_message", messageData, (ack) => {
      if (ack?.success) {
        // Replace optimistic message with real one
        setMessages((prev) => {
          const roomMessages = prev[selectedRoom] || [];
          const filteredMessages = roomMessages.filter(
            (msg) => msg.id !== tempId
          );

          if (ack.message) {
            const newMessages = [...filteredMessages, ack.message];
            newMessages.sort(
              (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );

            return {
              ...prev,
              [selectedRoom]: newMessages,
            };
          }

          return prev;
        });
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
      }
    });

    setMessage("");
  };

  // Close room
  const handleCloseRoom = () => {
    if (
      selectedRoom &&
      window.confirm("Are you sure you want to close this chat?")
    ) {
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
      const timestamp = msg.created_at;
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

  const messageGroups = groupMessagesByDate(currentMessages);


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
                          {lastMessage?.created_at
                            ? formatLastSeen(lastMessage.created_at)
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
              {currentMessages.length === 0 ? (
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
                  {Object.entries(messageGroups).map(([date, dateMessages]) => (
                    <div key={date}>
                      <div className="sticky top-0 z-10 flex justify-center mb-4">
                        <div className="bg-blue-100 text-blue-800 text-xs font-medium px-4 py-2 rounded-full">
                          {date}
                        </div>
                      </div>
                      <div className="space-y-4">
                    

                        {dateMessages.map((msg) => {

                          const isSender = msg.senderId === user?.id;
                          const isRead = msg.isRead;
                          const isOptimistic = msg.isOptimistic;
                          const timestamp = msg.createdAt
                            ? new Date(msg.createdAt)
                            : null;

                          return (
                            <div
                              key={msg.id}
                              className={`flex ${
                                isSender ? "justify-end" : "justify-start"
                              } mb-2 px-4`}
                            >
                              {/* WhatsApp-style message bubble */}
                              <div
                                className={`relative max-w-[65%] rounded-2xl px-3 py-2 ${
                                  isSender
                                    ? isOptimistic
                                      ? "bg-[#D9FDD3] rounded-tr-sm"
                                      : "bg-[#D9FDD3] rounded-tr-sm"
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
                                    <span
                                      className={`text-xs ${
                                        isSender
                                          ? "text-gray-500"
                                          : "text-gray-500"
                                      }`}
                                    >
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
                                    <div className="w-4 h-4 bg-[#D9FDD3] transform rotate-45 origin-bottom-left"></div>
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
