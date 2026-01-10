const ChatController = require("../controllers/chatController");
const { chatAuth } = require("../middleware/chatAuth");

class ChatHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // socketId -> userId
    this.userSockets = new Map(); // userId -> socketId
    this.adminSockets = new Set(); // Set of admin socket IDs
    this.userRooms = new Map(); // userId -> roomId
    this.typingUsers = new Map(); // roomId -> {userId, timeout}
    this.roomParticipants = new Map(); // Cache room participants
  }

  initialize() {
    // Add authentication middleware
    this.io.use(chatAuth);

    this.io.on("connection", async (socket) => {
      console.log(`User connected: ${socket.user.id} (${socket.user.email})`);

      const userId = socket.user.id;
      const isAdmin = socket.user.isAdmin;

      // Store user connection
      this.connectedUsers.set(socket.id, userId);
      this.userSockets.set(userId, socket.id);

      if (isAdmin) {
        this.adminSockets.add(socket.id);
        socket.join("admin-room");
        console.log("Admin connected");

        // Notify all connected customers that admin is online
        this.broadcastToCustomers("admin_online", { isOnline: true });
      } else {
        // Customer: Get or create chat room
        await this.handleCustomerConnection(socket, userId);
      }

      // Setup event handlers
      this.setupEventHandlers(socket, userId, isAdmin);

      // Handle disconnect
      socket.on("disconnect", () =>
        this.handleDisconnect(socket, userId, isAdmin)
      );
    });
  }

  async handleCustomerConnection(socket, userId) {
    try {
      // Get or create room for customer
      const room = await ChatController.getOrCreateRoom(userId);
      this.userRooms.set(userId, room.id);

      this.roomParticipants.set(room.id, {
        customerId: room.customerId,
        adminId: room.adminId,
      });

      // Join the room
      socket.join(room.roomName);
      socket.roomId = room.id;
      socket.roomName = room.roomName;

      // Load chat history
      const messages = await ChatController.getChatHistory(room.id, userId);

      socket.emit("chat_history", {
        roomId: room.id,
        messages: messages.map((msg) => ({
          id: msg.id,
          senderId: msg.senderId,
          senderEmail: msg.sender.email,
          receiverId: msg.receiverId,
          message: msg.message,
          messageType: msg.messageType,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
        })),
      });

      // Notify admin about new customer connection
      this.io.to("admin-room").emit("customer_connected", {
        userId,
        roomId: room.id,
        customerEmail: socket.user.email,
      });
    } catch (error) {
      console.error("Error handling customer connection:", error);
      socket.emit("error", { message: "Failed to initialize chat" });
    }
  }

  setupEventHandlers(socket, userId, isAdmin) {
    // Send message
    socket.on("send_message", async (data) => {
      await this.handleSendMessage(socket, userId, isAdmin, data);
    });

    // Typing indicator
    socket.on("typing", (data) => {
      this.handleTyping(socket, userId, data);
    });

    // Mark as read
    socket.on("mark_as_read", async (data) => {
      await this.handleMarkAsRead(socket, userId, data);
    });

    // Clear chat
    socket.on("clear_chat", async () => {
      await this.handleClearChat(socket, userId);
    });

    // Join specific room (admin joining customer room)
    socket.on("join_room", (roomId) => {
      this.handleJoinRoom(socket, roomId);
    });
  }

  async handleSendMessage(socket, userId, isAdmin, data) {
    try {
      const { receiverId, message, messageType = "text" } = data;

      let roomId = socket.roomId;

      // If admin is sending to a specific room
      if (isAdmin && data.roomId) {
        roomId = data.roomId;
      }

      // Validate input
      if (!roomId || !message?.trim()) {
        return socket.emit("error", { message: "Invalid message data" });
      }

      // Get room information
      const room = await require("../models/ChatRoom").findByPk(roomId);
      if (!room) {
        return socket.emit("error", { message: "Chat room not found" });
      }

      // Security: Validate sender has permission to send in this room
      if (!isAdmin && room.customerId !== userId) {
        return socket.emit("error", {
          message: "Access denied to this chat room",
        });
      }

      // Security: Validate receiver is a participant in this room
      const roomParticipants = [room.customerId, room.adminId].filter(
        (id) => id
      );

      const actualReceiverId = isAdmin ? room.customerId : room.adminId || null;

      // Only validate receiverId if provided, otherwise use actual participant
      if (receiverId && !roomParticipants.includes(receiverId)) {
        return socket.emit("error", { message: "Invalid receiver" });
      }

      // Determine final receiver (use provided or default)
      const finalReceiverId = receiverId || actualReceiverId;

      // Prevent sending to self
      if (finalReceiverId === userId) {
        return socket.emit("error", {
          message: "Cannot send message to yourself",
        });
      }

      // Validate message length
      if (message.trim().length > 2000) {
        return socket.emit("error", {
          message: "Message too long (max 2000 characters)",
        });
      }

      // Save message to database
      const savedMessage = await ChatController.saveMessage(
        roomId,
        userId,
        finalReceiverId,
        message,
        messageType
      );

      // Prepare message data
      const messageData = {
        id: savedMessage.id,
        roomId,
        senderId: userId,
        senderEmail: socket.user.email,
        receiverId: finalReceiverId,
        message: savedMessage.message,
        messageType: savedMessage.messageType,
        isRead: false,
        createdAt: savedMessage.createdAt,
      };

      // Send confirmation to sender
      socket.emit("message_sent", messageData);

      // Send to ALL participants in the room using room name
      // This ensures both customer and admin receive the message
      this.io.to(room.roomName).emit("receive_message", messageData);

      // Also send to receiver's individual socket if they're not in the room
      // (this handles cases where socket might not have joined the room properly)
      const receiverSocketId = this.userSockets.get(finalReceiverId);
      if (receiverSocketId && !socket.rooms.has(room.roomName)) {
        this.io.to(receiverSocketId).emit("receive_message", messageData);
      }

      // Update last message timestamp in room
      await room.update({ lastMessageAt: new Date() });

      // Clear typing indicator
      this.clearTypingIndicator(roomId, userId);

      // Return success acknowledgement
      return { success: true, messageId: savedMessage.id };
    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", {
        message: "Failed to send message. Please try again.",
      });
      return { success: false, error: error.message };
    }
  }

  handleTyping(socket, userId, data) {
    const { roomId, isTyping } = data;

    if (!roomId) return;

    // Clear existing timeout
    const typingKey = `${roomId}_${userId}`;
    if (this.typingUsers.has(typingKey)) {
      clearTimeout(this.typingUsers.get(typingKey));
      this.typingUsers.delete(typingKey);
    }

    if (isTyping) {
      // Set timeout to automatically clear typing indicator after 2 seconds
      const timeout = setTimeout(() => {
        this.typingUsers.delete(typingKey);
        this.broadcastTyping(roomId, userId, false);
      }, 2000);

      this.typingUsers.set(typingKey, timeout);
    }

    // Broadcast typing indicator
    this.broadcastTyping(roomId, userId, isTyping);
  }

  broadcastTyping(roomId, userId, isTyping) {
    // Get room to find participants
    // require("../models/ChatRoom")
    //   .findByPk(roomId)
    //   .then((room) => {
    //     if (!room) return;

    //     const receiverId =
    //       room.customerId === userId ? room.adminId || null : room.customerId;

    //     if (receiverId) {
    //       const receiverSocketId = this.userSockets.get(receiverId);
    //       if (receiverSocketId) {
    //         this.io.to(receiverSocketId).emit("user_typing", {
    //           roomId,
    //           userId,
    //           isTyping,
    //         });
    //       }
    //     }
    //   })
    //   .catch((error) => console.error("Error broadcasting typing:", error));

    const participants = this.roomParticipants.get(roomId);
    if (!participants) return;

    const otherUserId =
      participants.customerId === userId
        ? participants.adminId
        : participants.customerId;

    if (otherUserId) {
      const receiverSocketId = this.userSockets.get(otherUserId);
      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit("user_typing", {
          roomId,
          userId,
          isTyping,
        });
      }
    }
  }

  clearTypingIndicator(roomId, userId) {
    const typingKey = `${roomId}_${userId}`;
    if (this.typingUsers.has(typingKey)) {
      clearTimeout(this.typingUsers.get(typingKey));
      this.typingUsers.delete(typingKey);
      this.broadcastTyping(roomId, userId, false);
    }
  }

  async handleMarkAsRead(socket, userId, data) {
    try {
      const { messageIds, roomId } = data;

      if (!messageIds || !Array.isArray(messageIds)) {
        return socket.emit("error", { message: "Invalid message IDs" });
      }

      await ChatController.markAsRead(messageIds, userId);

      // Notify sender that messages were read
      const messages = await require("../models/Message").findAll({
        where: { id: messageIds },
        attributes: ["id", "senderId"],
      });

      messages.forEach((message) => {
        const senderSocketId = this.userSockets.get(message.senderId);
        if (senderSocketId) {
          this.io.to(senderSocketId).emit("message_read", {
            messageIds,
            roomId,
            readAt: new Date(),
          });
        }
      });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  }

  async handleClearChat(socket, userId) {
    try {
      const roomId = socket.roomId;

      if (!roomId) {
        return socket.emit("error", { message: "No active chat room" });
      }

      await ChatController.clearChat(userId, roomId);

      // Notify user
      socket.emit("chat_cleared", {
        roomId,
        clearedAt: new Date(),
      });

      // Notify other participant
      const room = await require("../models/ChatRoom").findByPk(roomId);
      if (room) {
        const otherUserId =
          room.customerId === userId ? room.adminId || null : room.customerId;

        if (otherUserId) {
          const otherSocketId = this.userSockets.get(otherUserId);
          if (otherSocketId) {
            this.io.to(otherSocketId).emit("chat_cleared_by_other", {
              roomId,
              clearedBy: userId,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error clearing chat:", error);
      socket.emit("error", { message: "Failed to clear chat" });
    }
  }

  handleJoinRoom(socket, roomId) {
    require("../models/ChatRoom")
      .findByPk(roomId)
      .then((room) => {
        if (room) {
          if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
          }

          socket.join(room.roomName);
          socket.roomId = room.id;
          socket.roomName = room.roomName;
          socket.emit("room_joined", { roomId: room.id });
        }
      })
      .catch((error) => {
        console.error("Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      });
  }

  handleDisconnect(socket, userId, isAdmin) {
    console.log(`User disconnected: ${userId}`);

    // Remove from connected users
    this.connectedUsers.delete(socket.id);
    this.userSockets.delete(userId);

    // Remove from room participants cache
    if (socket.roomId) {
      const participants = this.roomParticipants.get(socket.roomId);
      if (participants) {
        if (participants.customerId === userId) {
          this.roomParticipants.delete(socket.roomId);
        }
      }
    }

    if (isAdmin) {
      this.adminSockets.delete(socket.id);

      // Notify all customers that admin went offline
      this.broadcastToCustomers("admin_online", { isOnline: false });

      console.log("Admin disconnected");
    } else {
      // Remove from user rooms
      this.userRooms.delete(userId);

      // Notify admin about customer disconnect
      this.io.to("admin-room").emit("customer_online", {
        userId,
        isOnline: false,
      });
    }

    // Clear any typing indicators
    this.clearAllTypingIndicators(userId);
  }

  clearAllTypingIndicators(userId) {
    for (const [key, timeout] of this.typingUsers.entries()) {
      if (key.endsWith(`_${userId}`)) {
        clearTimeout(timeout);
        this.typingUsers.delete(key);

        const [roomId] = key.split("_");
        this.broadcastTyping(roomId, userId, false);
      }
    }
  }

  broadcastToCustomers(event, data) {
    // Broadcast to all connected customers
    for (const [socketId, userId] of this.connectedUsers.entries()) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && !socket.user.isAdmin) {
        socket.emit(event, data);
      }
    }
  }
}

module.exports = ChatHandler;
