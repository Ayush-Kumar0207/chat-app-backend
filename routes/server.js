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

mongoose.set('bufferCommands', false); // 🔥 Prevent buffering timeout

const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully!');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    setTimeout(connectToDB, 5000); // Retry connection
  }
};

connectToDB();

const allowedOrigins = [
  'http://localhost:3000',
  'https://encryptedchatapp.netlify.app'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('✅ Chat App Backend is running!');
});

// ... socket.io setup remains the same ...

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
