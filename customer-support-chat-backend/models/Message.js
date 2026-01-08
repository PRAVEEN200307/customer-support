const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const ChatRoom = require('./ChatRoom');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roomId: {
    type: DataTypes.UUID,
    field: 'room_id',
    allowNull: false,
    references: {
      model: ChatRoom,
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.UUID,
    field: 'sender_id',
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.UUID,
    field: 'receiver_id',
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  messageType: {
    type: DataTypes.STRING,
    field: 'message_type',
    defaultValue: 'text'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    field: 'is_read',
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE,
    field: 'read_at',
    allowNull: true
  }
}, {
  tableName: 'messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Associations
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
Message.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId' });
Message.belongsTo(ChatRoom, { as: 'room', foreignKey: 'roomId' });

module.exports = Message;