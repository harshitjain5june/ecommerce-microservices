const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// In-memory notification storage: userId → [notifications]
const notifications = {};

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Notifications service is running',
    totalUsers: Object.keys(notifications).length,
    totalNotifications: Object.values(notifications).flat().length,
    timestamp: new Date().toISOString()
  });
});

// Send notification
app.post('/api/notifications/send', (req, res) => {
  const { userId, message, type } = req.body;

  if (!userId || !message || !type) {
    return res.status(400).json({
      success: false,
      message: 'userId, message, and type are required'
    });
  }

  const notification = {
    id: Date.now(),
    userId,
    message,
    type,
    timestamp: new Date()
  };

  if (!notifications[userId]) {
    notifications[userId] = [];
  }

  notifications[userId].push(notification);

  console.log(`📨 Notification sent to user ${userId}: ${message} (${type})`);

  res.status(201).json({
    success: true,
    message: 'Notification sent',
    data: notification
  });
});

// Get all notifications for a user
app.get('/api/notifications/user/:userId', (req, res) => {
  const { userId } = req.params;
  const userNotifications = notifications[userId] || [];

  res.json({
    success: true,
    data: {
      userId,
      notifications: userNotifications
    }
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'Notifications Service API',
    endpoints: {
      sendNotification: 'POST /api/notifications/send',
      getUserNotifications: 'GET /api/notifications/user/:userId',
      healthCheck: 'GET /api/health'
    },
    exampleNotification: {
      userId: 'u123',
      message: 'Your order #1234 has been confirmed!',
      type: 'order_confirmed'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🔔 Notifications service running on port ${PORT}`);
});

module.exports = app;
