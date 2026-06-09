const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

let adminSocketId = null;
let isLive = false;
const listeners = new Set();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

function emitStatus() {
  io.emit('status', {
    isLive,
    listeners: listeners.size,
    hasAdmin: Boolean(adminSocketId)
  });
}

io.on('connection', (socket) => {
  socket.emit('status', {
    isLive,
    listeners: listeners.size,
    hasAdmin: Boolean(adminSocketId)
  });

  socket.on('admin-auth', (password, callback) => {
    if (password !== ADMIN_PASSWORD) {
      if (callback) callback({ ok: false, message: 'Senha incorreta.' });
      return;
    }

    if (adminSocketId && adminSocketId !== socket.id) {
      if (callback) callback({ ok: false, message: 'Ja existe um admin conectado.' });
      return;
    }

    adminSocketId = socket.id;
    socket.data.role = 'admin';
    if (callback) callback({ ok: true });
    emitStatus();
  });

  socket.on('start-live', () => {
    if (socket.id !== adminSocketId) return;
    isLive = true;
    emitStatus();
  });

  socket.on('stop-live', () => {
    if (socket.id !== adminSocketId) return;
    isLive = false;
    io.emit('live-ended');
    emitStatus();
  });

  socket.on('listener-ready', () => {
    socket.data.role = 'listener';
    listeners.add(socket.id);
    emitStatus();

    if (adminSocketId && isLive) {
      io.to(adminSocketId).emit('listener-ready', socket.id);
    }
  });

  socket.on('offer', ({ to, offer }) => {
    if (socket.id !== adminSocketId) return;
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    if (socket.id === adminSocketId) {
      adminSocketId = null;
      isLive = false;
      io.emit('live-ended');
    }

    if (listeners.has(socket.id)) {
      listeners.delete(socket.id);
      if (adminSocketId) {
        io.to(adminSocketId).emit('listener-disconnected', socket.id);
      }
    }

    emitStatus();
  });
});

server.listen(PORT, () => {
  console.log(`Radio ao vivo rodando em http://localhost:${PORT}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin`);
  console.log(`Senha admin padrao: ${ADMIN_PASSWORD}`);
});
