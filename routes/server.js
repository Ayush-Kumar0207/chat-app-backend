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

// ✅ RECOMMENDED for Mongoose
mongoose.set('strictQuery', false);

// ✅ Connect to MongoDB Atlas
const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully!');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    setTimeout(connectToDB, 5000); // Retry after delay
  }
};

connectToDB();

// ✅ CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://encryptedchatapp.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// ✅ Auth Routes
app.use('/api/auth', authRoutes);

// ✅ Health Route
app.get('/', (req, res) => {
  res.send('✅ Chat App Backend is running!');
});

// ✅ Add a /test route to verify MongoDB
app.get('/test', async (req, res) => {
  try {
    const count = await Message.countDocuments();
    res.send(`MongoDB connected. Total messages: ${count}`);
  } catch (err) {
    res.status(500).send('MongoDB query failed');
  }
});

// ✅ SOCKET.IO
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token provided'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  socket.on('send_message', async ({ recipientId, content }) => {
    const message = new Message({
      senderId: socket.userId,
      recipientId,
      content,
      createdAt: new Date()
    });
    await message.save();
    io.emit('receive_message', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

// ✅ Server Start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
