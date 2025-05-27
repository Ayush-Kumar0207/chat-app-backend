const express = require('express'); 
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const Message = require('./message');
const authRoutes = require('./auth');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000', // Update to your frontend URL on Render if deployed
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

// ✅ Add root route to avoid "Cannot GET /"
app.get('/', (req, res) => {
  res.send('✅ Chat App Backend is running!');
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Authenticate socket connections using JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication token missing'));
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = user;
    next();
  } catch (err) {
    return next(new Error('Authentication error'));
  }
});

// Handle socket events
io.on('connection', (socket) => {
  const userId = socket.user.userId;
  console.log(`✅ New client connected: ${userId}`);

  // Join room named by user ID
  socket.join(userId);

  socket.on('send_message', async ({ recipientId, content }) => {
    try {
      const message = await Message.create({
        sender: userId,
        recipient: recipientId,
        content, // This should already be encrypted
      });

      // Emit to recipient's room
      io.to(recipientId).emit('receive_message', {
        senderId: userId,
        content,
        createdAt: message.createdAt,
      });

    } catch (err) {
      console.error('❌ Error sending message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${userId}`);
  });
});

// Handle socket connection errors
io.on('connection_error', (err) => {
  console.error('❌ Connection error:', err.message);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
