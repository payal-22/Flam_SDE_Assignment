const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '10mb' })); 
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 10e6 
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  let currentRoom = null;
  let currentUsername = null;
  let currentColor = null;

  socket.on('join-room', ({ roomId, username, color }) => {
    currentRoom = roomId;
    currentUsername = username;
    currentColor = color;

    socket.join(roomId);
    console.log(`${username} joined room: ${roomId}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        users: new Map(),
        history: [],
        state: null,
        cursors: new Map()
      });
    }

    const room = rooms.get(roomId);
    
    room.users.set(socket.id, { username, color, id: socket.id });

    if (room.state) {
      socket.emit('canvas-state', room.state);
    }
    const userList = Array.from(room.users.values());
    io.to(roomId).emit('users-update', userList);

    room.cursors.forEach((cursor, userId) => {
      if (userId !== socket.id) {
        socket.emit('cursor-move', cursor);
      }
    });

    console.log(`Room ${roomId} now has ${room.users.size} users`);
  });

  socket.on('draw', (data) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    room.history.push({
      ...data,
      timestamp: Date.now(),
      userId: socket.id,
      username: currentUsername
    });

    socket.to(currentRoom).emit('draw', data);
  });

  socket.on('draw-text', (data) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    room.history.push({
      type: 'text',
      ...data,
      timestamp: Date.now(),
      userId: socket.id,
      username: currentUsername
    });

    socket.to(currentRoom).emit('draw-text', data);
  });

  socket.on('draw-image', (data) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    room.history.push({
      type: 'image',
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      timestamp: Date.now(),
      userId: socket.id,
      username: currentUsername
    });

    socket.to(currentRoom).emit('draw-image', data);
  });

  socket.on('cursor-move', ({ x, y }) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    const cursorData = {
      userId: socket.id,
      username: currentUsername,
      color: currentColor,
      x,
      y
    };

    room.cursors.set(socket.id, cursorData);

    socket.to(currentRoom).emit('cursor-move', cursorData);
  });

  socket.on('clear-canvas', () => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    room.history = [];
    room.state = null;

    io.to(currentRoom).emit('clear-canvas');
    
    console.log(`Canvas cleared in room: ${currentRoom}`);
  });

  socket.on('save-canvas', (dataURL) => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    room.state = dataURL;
    console.log(`Canvas state saved for room: ${currentRoom}`);
  });

  socket.on('request-canvas-state', () => {
    if (!currentRoom) return;

    const room = rooms.get(currentRoom);
    if (!room) return;

    if (room.state) {
      socket.emit('canvas-state', room.state);
    }
  });

  socket.on('ping', (callback) => {
    callback();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(socket.id);
        room.cursors.delete(socket.id);

        socket.to(currentRoom).emit('user-left', { userId: socket.id });

        const userList = Array.from(room.users.values());
        io.to(currentRoom).emit('users-update', userList);

        console.log(`${currentUsername} left room: ${currentRoom}`);
        console.log(`Room ${currentRoom} now has ${room.users.size} users`);

        if (room.users.size === 0) {
          setTimeout(() => {
            const currentRoom = rooms.get(currentRoom);
            if (currentRoom && currentRoom.users.size === 0) {
              rooms.delete(currentRoom);
              console.log(`Room ${currentRoom} deleted (empty)`);
            }
          }, 5 * 60 * 1000); 
        }
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    totalUsers: Array.from(rooms.values()).reduce((sum, room) => sum + room.users.size, 0)
  });
});

app.get('/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    roomId,
    users: Array.from(room.users.values()),
    historyLength: room.history.length,
    hasState: !!room.state
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🔗 Connect clients to: http://localhost:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});