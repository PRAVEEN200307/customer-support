const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const DeletedChat = require('../models/DeletedChat');
const { Op } = require('sequelize');

class ChatController {
  // Get or create chat room for customer
  static async getOrCreateRoom(userId, adminId = "ff283a6d-fa7e-4d64-9a1f-044e380162e1") {
    try {
      let room = await ChatRoom.findOne({
        where: { customerId: userId },
        include: [
          { model: require('../models/User'), as: 'customer', attributes: ['id', 'email'] },
          { model: require('../models/User'), as: 'admin', attributes: ['id', 'email'] }
        ]
      });

      if (!room) {
        room = await ChatRoom.create({
          customerId: userId,
          adminId,
          roomName: `room_${userId}`,
          isActive: true
        });
      }

      return room;
    } catch (error) {
      console.error('Error getting/creating room:', error);
      throw error;
    }
  }

  // Get chat history for user
  static async getChatHistory(roomId, userId, limit = 100, offset = 0) {
    try {
      // Check if user has cleared chat
      const deletedChat = await DeletedChat.findOne({
        where: { userId, roomId }
      });

      let whereCondition = { roomId };
      
      // If user cleared chat, only show messages after deletion
      if (deletedChat) {
        whereCondition.created_at = { [Op.gt]: deletedChat.createdAt };
      }

      const messages = await Message.findAll({
        where: whereCondition,
        include: [
          { 
            model: require('../models/User'), 
            as: 'sender', 
            attributes: ['id', 'email'] 
          },
          { 
            model: require('../models/User'), 
            as: 'receiver', 
            attributes: ['id', 'email'] 
          }
        ],
        order: [['created_at', 'ASC']],
        limit,
        offset
      });

      return messages;
    } catch (error) {
      console.error('Error getting chat history:', error);
      throw error;
    }
  }

  // Save message to database
  static async saveMessage(roomId, senderId, receiverId, message, messageType = 'text') {
    try {
      const newMessage = await Message.create({
        roomId,
        senderId,
        receiverId, 
        message: message.trim(),
        messageType
      });

      // Populate sender info
      const populatedMessage = await Message.findByPk(newMessage.id, {
        include: [
          { model: require('../models/User'), as: 'sender', attributes: ['id', 'email'] },
          { model: require('../models/User'), as: 'receiver', attributes: ['id', 'email'] }
        ]
      });

      return populatedMessage;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markAsRead(messageIds, userId) {
    try {
      await Message.update(
        { 
          isRead: true,
          readAt: new Date()
        },
        { 
          where: { 
            id: messageIds,
            receiverId: userId
          } 
        }
      );

      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Clear chat for user
  static async clearChat(userId, roomId) {
    try {
      await DeletedChat.upsert({
        userId,
        roomId
      });

      return true;
    } catch (error) {
      console.error('Error clearing chat:', error);
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
            model: require('../models/User'), 
            as: 'customer', 
            attributes: ['id', 'email', 'created_at'] 
          }
        ],
        // order: [['last_message_at', 'DESC']]
      });

      return rooms;
    } catch (error) {
      console.error('Error getting all rooms:', error);
      throw error;
    }
  }

  // Get unread message count for user
  static async getUnreadCount(userId) {
    try {
      const count = await Message.count({
        include: [{
          model: ChatRoom,
          as: 'room',
          where: {
            [Op.or]: [
              { customerId: userId },
              { adminId: userId }
            ]
          }
        }],
        where: {
          receiverId: userId,
          isRead: false
        }
      });

      return count;
    } catch (error) {
      console.error('Error counting unread messages:', error);
      throw error;
    }
  }
}

module.exports = ChatController;