const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const ChatRoom = require('./ChatRoom');

const DeletedChat = sequelize.define('DeletedChat', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id',
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  roomId: {
    type: DataTypes.UUID,
    field: 'room_id',
    allowNull: false,
    references: {
      model: ChatRoom,
      key: 'id'
    }
  }
}, {
  tableName: 'deleted_chats',
  timestamps: true,
  createdAt: 'deleted_at',
  updatedAt: false
});

// Associations
DeletedChat.belongsTo(User, { foreignKey: 'userId' });
DeletedChat.belongsTo(ChatRoom, { foreignKey: 'roomId' });

module.exports = DeletedChat;