const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// --- Socket.IO Logic

const connectedUsers = new Map();

io.on('connection', (socket) => {
  // Join group
  socket.on('join-group', async (data) => {
    try {
      const { groupId, userId, username, isTyping } = data;
      socket.join(groupId);
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true }
      });
      connectedUsers.set(socket.id, { userId, groupId, username });

      socket.to(groupId).emit('user-joined', {
        userId,
        username   // emit username (NEVER 'User joined the group')
      });
    } catch (error) {
      console.error('Error joining group:', error);
    }
  });

 socket.on('send-message', async (messageData) => {
  try {
    const { content, senderId, groupId, type = 'TEXT', isAnonymous } = messageData;
    const user = await prisma.user.findUnique({ where: { id: senderId } });
    if (!user) return;

    // Save the message along with isAnonymous flag
    const message = await prisma.message.create({
      data: { content, type, senderId, groupId, isAnonymous }
    });

    io.to(groupId).emit('new-message', {
      id: message.id,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt,
      isAnonymous,
      sender: {
        id: user.id,
        username: isAnonymous ? 'Anonymous' : user.username,
        avatar: user.avatar,
        isOnline: user.isOnline
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
});


  // Typing indicator
socket.on('typing', (data) => {
  const { groupId, userId, username, isTyping } = data;

  // Broadcast to everyone in the room except the one who typed
  socket.to(groupId).emit('user-typing', {
    userId,
    username,
    isTyping
  });
});


  // Disconnect & leave group
  socket.on('disconnect', async () => {
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      try {
        await prisma.user.update({
          where: { id: userData.userId },
          data: { isOnline: false }
        });
        socket.to(userData.groupId).emit('user-left', {
          userId: userData.userId,
          username: userData.username
        });
        connectedUsers.delete(socket.id);
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    }
  });

  // Handle status events
  socket.on('user-status', ({ userId, isOnline }) => {
    // Broadcast online/offline status
    io.emit('user-status', { userId, isOnline });
  });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
