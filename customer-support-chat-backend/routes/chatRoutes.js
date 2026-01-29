const express = require("express");
const router = express.Router();
const ChatController = require("../controllers/chatController");
const User = require("../models/User");
const { verifyToken } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = require("../config/s3.js");


// Get user's chat room
router.get("/my-room", verifyToken, async (req, res) => {
  try {
    const room = await ChatController.getOrCreateRoom(req.user.id);

    res.json({
      success: true,
      room,
    });
  } catch (error) {
    console.error("Error getting user room:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get chat history
router.get("/history/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Verify user has access to this room
    const room = await require("../models/ChatRoom").findByPk(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found",
      });
    }

    // Check if user is participant
    const user = await User.findByPk(req.user.id);
    const isAdmin = req.user.userType === "admin";

    if (!isAdmin && room.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this chat room",
      });
    }

    const messages = await ChatController.getChatHistory(
      roomId,
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Mark messages as read
router.post("/messages/read", verifyToken, async (req, res) => {
  try {
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        message: "Message IDs array is required",
      });
    }

    await ChatController.markAsRead(messageIds, req.user.id);

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Clear chat history
router.post("/clear/:roomId", verifyToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    await ChatController.clearChat(req.user.id, roomId);

    res.json({
      success: true,
      message: "Chat cleared successfully",
    });
  } catch (error) {
    console.error("Error clearing chat:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Get unread count
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const count = await ChatController.getUnreadCount(req.user.id);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Admin only: Get all chat rooms
router.get("/admin/rooms", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    // Check if user is admin (adjust this based on your admin identification)
    if (req.user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const rooms = await ChatController.getAllRooms(req.user.id);
    console.log("All Rooms:", rooms);
    res.json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Admin only: Close and delete chat room
router.delete("/admin/close/:roomId", verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const { roomId } = req.params;
    await ChatController.adminCloseChat(roomId);

    res.json({
      success: true,
      message: "Chat room and history deleted successfully",
    });
  } catch (error) {
    console.error("Error closing chat:", error);
    if (error.message === "Chat room not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/upload", upload.single("file"), (req, res) => {
  return res.status(200).json({
    success: true,
    message: "File uploaded successfully",
    fileKey: req.file.key, 
  });
});

router.get("/file-url", async (req, res) => {
  const { key } = req.query;

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 3600,
  });

  res.json({ success: true, url: signedUrl });
});

module.exports = router;
