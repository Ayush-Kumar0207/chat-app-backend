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
    origin: [
      'http://localhost:3000',
      'https://chat-app-frontend.onrender.com', // ✅ Replace with your actual frontend Render URL
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ✅ Enable CORS for both local and deployed frontend
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://chat-app-frontend.onrender.com', // ✅ Replace this too
  ],
  credentials: true,
}));

app.use(express.json());

// ✅ Route setup
app.use('/api/auth', authRoutes);

// ✅ Root route
app.get('/', (req, res) => {
  res.send('✅ Chat App Backend is running!');
});

// ✅ Optional: enable detailed Mongoose logs
mongoose.set('debug', true);

// ✅ Debug log: check if MONGO_URI is loaded correctly (remove later)
console.log('🔧 Connecting to MongoDB URI:', process.env.MONGO_URI);

// ✅ MongoDB connection with longer timeout
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 20000, // wait up to 20s
    socketTimeoutMS: 45000,          // wait up to 45s
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Socket.io JWT auth middleware
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

// ✅ Socket connection handler
io.on('connection', (socket) => {
  const userId = socket.user.userId;
  console.log(`✅ New client connected: ${userId}`);

  socket.join(userId);

  socket.on('send_message', async ({ recipientId, content }) => {
    try {
      const message = await Message.create({
        sender: userId,
        recipient: recipientId,
        content,
      });

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

io.on('connection_error', (err) => {
  console.error('❌ Connection error:', err.message);
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
