const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');

const ChatRoom = sequelize.define('ChatRoom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customerId: {
    type: DataTypes.UUID,
    field: 'customer_id',
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  adminId: {
    type: DataTypes.UUID,
    field: 'admin_id',
    allowNull: true,
    references: {
      model: User,
      key: 'id'
    }
  },
  roomName: {
    type: DataTypes.STRING,
    field: 'room_name',
    allowNull: false,
    unique: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    field: 'last_message_at',
    allowNull: true
  }
}, {
  tableName: 'chat_rooms',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
ChatRoom.belongsTo(User, { as: 'customer', foreignKey: 'customerId' });
ChatRoom.belongsTo(User, { as: 'admin', foreignKey: 'adminId' });

module.exports = ChatRoom;
