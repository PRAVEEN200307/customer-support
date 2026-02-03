const ChatRoom = require("../models/ChatRoom");
const Message = require("../models/Message");
const DeletedChat = require("../models/DeletedChat");
const { Op } = require("sequelize");
const User = require("../models/User");

class ChatController {
  // Get or create chat room for customer
  static async getOrCreateRoom(userId) {
    try {
      const admin = await require("../models/User").findOne({
        where: { userType: "admin", isActive: true },
      });

      if (!admin) {
        throw new Error("No admin available");
      }

      let room = await ChatRoom.findOne({
        where: { customerId: userId },
        include: [
          {
            model: require("../models/User"),
            as: "customer",
            attributes: ["id", "email"],
          },
          {
            model: require("../models/User"),
            as: "admin",
            attributes: ["id", "email"],
          },
        ],
      });

      if (!room) {
        room = await ChatRoom.create({
          customerId: userId,
          adminId: admin.id,
          roomName: `room_${userId}`,
          isActive: true,
        });
      }

      return room;
    } catch (error) {
      console.error("Error getting/creating room:", error);
      throw error;
    }
  }

  // Get chat history for user
  static async getChatHistory(roomId, userId, limit = 100, offset = 0) {
    try {
      const deletedChat = await DeletedChat.findOne({
        where: { userId, roomId },
        defaults: { deleted_at: new Date() },
      });

      const whereCondition = { roomId };

      if (deletedChat) {
        whereCondition.created_at = {
          [Op.gt]: deletedChat.get("deleted_at"),
        };
      }

      return await Message.findAll({
        where: whereCondition,
        include: [
          { model: User, as: "sender", attributes: ["id", "email"] },
          { model: User, as: "receiver", attributes: ["id", "email"] },
        ],
        order: [["created_at", "ASC"]],
        limit,
        offset,
      });
    } catch (error) {
      console.error("Error getting chat history:", error);
      throw error;
    }
  }

  // Save message to database
  static async saveMessage(
    roomId,
    senderId,
    receiverId,
    message,
    messageType = "text",
    fileKey = null,
    fileName = null,
    fileSize = null,
    fileType = null
  ) {
    try {
      const newMessage = await Message.create({
        roomId,
        senderId,
        receiverId,
        message: message.trim(),
        messageType,
        fileKey,
        fileName,
        fileSize,
        fileType,
      });

      // Populate sender info
      const populatedMessage = await Message.findByPk(newMessage.id, {
        include: [
          {
            model: require("../models/User"),
            as: "sender",
            attributes: ["id", "email"],
          },
          {
            model: require("../models/User"),
            as: "receiver",
            attributes: ["id", "email"],
          },
        ],
      });

      return populatedMessage;
    } catch (error) {
      console.error("Error saving message:", error);
      throw error;
    }
  }

  // Mark messages as read
  static async markAsRead(messageIds, userId) {
    try {
      await Message.update(
        {
          isRead: true,
          readAt: new Date(),
        },
        {
          where: {
            id: messageIds,
            receiverId: userId,
          },
        }
      );

      return true;
    } catch (error) {
      console.error("Error marking messages as read:", error);
      throw error;
    }
  }

  // Clear chat for user
  static async clearChat(userId, roomId) {
    try {
      const response = await DeletedChat.findOrCreate({
        where: { userId, roomId },
        defaults: { deleted_at: new Date() },
      });

      const record = response[0];
      const wasCreated = response[1];

      if (!wasCreated) {
        await record.update({ deleted_at: new Date() });
      }

      return true;
    } catch (error) {
      console.error("Error clearing chat:", error);
      throw error;
    }
  }

  // Get all active rooms (admin only)
  static async getAllRooms(adminId) {
    try {
      const rooms = await ChatRoom.findAll({
        where: { isActive: true },
        include: [
          {
            model: require("../models/User"),
            as: "customer",
            attributes: ["id", "email", "created_at"],
          },
        ],
        // order: [['last_message_at', 'DESC']]
      });

      return rooms;
    } catch (error) {
      console.error("Error getting all rooms:", error);
      throw error;
    }
  }

  // Get unread message count for user
  static async getUnreadCount(userId) {
    try {
      const count = await Message.count({
        include: [
          {
            model: ChatRoom,
            as: "room",
            where: {
              [Op.or]: [{ customerId: userId }, { adminId: userId }],
            },
          },
        ],
        where: {
          receiverId: userId,
          isRead: false,
        },
      });

      return count;
    } catch (error) {
      console.error("Error counting unread messages:", error);
      throw error;
    }
  }

  // Admin: Close and delete chat room and all associated messages
  static async adminCloseChat(roomId) {
    const { sequelize } = require("../config/database");
    const transaction = await sequelize.transaction();
    try {
      const room = await ChatRoom.findByPk(roomId, { transaction });
      if (!room) {
        throw new Error("Chat room not found");
      }

      // Explicitly delete associated data to avoid foreign key constraints
      await Message.destroy({ where: { roomId }, transaction });
      await DeletedChat.destroy({ where: { roomId }, transaction });

      // Delete the room
      await room.destroy({ transaction });

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      console.error("Error closing chat room:", error);
      throw error;
    }
  }
}

module.exports = ChatController;
