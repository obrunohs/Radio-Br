const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

let adminSocketId = null;
let tvLive = false;
let radioLive = false;
const listeners = new Set();
const chatHistory = [];
const users = new Map();
const mutedUntil = new Map();
const kickedUntil = new Map();
const bannedUsers = new Set();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

function isLive() {
  return tvLive || radioLive;
}

function publicUserList() {
  return Array.from(users.values()).map((u) => ({
    id: u.id,
    name: u.name,
    muted: (mutedUntil.get(u.id) || 0) > Date.now(),
    banned: bannedUsers.has(u.id),
    kicked: (kickedUntil.get(u.id) || 0) > Date.now()
  }));
}

function emitStatus() {
  io.emit('status', {
    isLive: isLive(),
    tvLive,
    radioLive,
    listeners: listeners.size,
    hasAdmin: Boolean(adminSocketId)
  });
  if (adminSocketId) io.to(adminSocketId).emit('chat-users', publicUserList());
}

function addMessage(message) {
  chatHistory.push(message);
  if (chatHistory.length > 80) chatHistory.shift();
  io.emit('chat-message', message);
}

io.on('connection', (socket) => {
  socket.emit('status', {
    isLive: isLive(),
    tvLive,
    radioLive,
    listeners: listeners.size,
    hasAdmin: Boolean(adminSocketId)
  });
  socket.emit('chat-history', chatHistory);

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

  socket.on('start-tv', () => {
    if (socket.id !== adminSocketId) return;
    tvLive = true;
    emitStatus();
  });

  socket.on('stop-tv', () => {
    if (socket.id !== adminSocketId) return;
    tvLive = false;
    io.emit('live-ended', { type: 'tv' });
    emitStatus();
  });

  socket.on('start-radio', () => {
    if (socket.id !== adminSocketId) return;
    radioLive = true;
    emitStatus();
  });

  socket.on('stop-radio', () => {
    if (socket.id !== adminSocketId) return;
    radioLive = false;
    io.emit('live-ended', { type: 'radio' });
    emitStatus();
  });

  socket.on('listener-ready', ({ type } = {}) => {
    socket.data.role = socket.data.role || 'listener';
    listeners.add(socket.id);
    emitStatus();

    if (adminSocketId && ((type === 'tv' && tvLive) || (type === 'radio' && radioLive))) {
      io.to(adminSocketId).emit('listener-ready', { id: socket.id, type });
    }
  });

  socket.on('offer', ({ to, offer, type }) => {
    if (socket.id !== adminSocketId) return;
    io.to(to).emit('offer', { from: socket.id, offer, type });
  });

  socket.on('answer', ({ to, answer, type }) => {
    io.to(to).emit('answer', { from: socket.id, answer, type });
  });

  socket.on('ice-candidate', ({ to, candidate, type }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate, type });
  });

  socket.on('register-name', ({ name }, callback) => {
    const cleanName = String(name || '').trim().slice(0, 20);
    if (!cleanName) {
      if (callback) callback({ ok: false, message: 'Digite um nome.' });
      return;
    }
    if (bannedUsers.has(socket.id) || (kickedUntil.get(socket.id) || 0) > Date.now()) {
      if (callback) callback({ ok: false, message: 'Voce nao pode entrar no chat no momento.' });
      return;
    }
    users.set(socket.id, { id: socket.id, name: cleanName });
    socket.data.chatName = cleanName;
    if (callback) callback({ ok: true, id: socket.id, name: cleanName });
    emitStatus();
  });

  socket.on('chat-message', ({ text }) => {
    const user = users.get(socket.id);
    if (!user) {
      socket.emit('chat-error', 'Cadastre um nome antes de enviar mensagens.');
      return;
    }
    if (bannedUsers.has(socket.id)) {
      socket.emit('chat-error', 'Voce foi banido do chat.');
      return;
    }
    const now = Date.now();
    if ((kickedUntil.get(socket.id) || 0) > now) {
      socket.emit('chat-error', 'Voce foi expulso temporariamente do chat.');
      return;
    }
    if ((mutedUntil.get(socket.id) || 0) > now) {
      socket.emit('chat-error', 'Voce esta silenciado temporariamente.');
      return;
    }

    const cleanText = String(text || '').trim().slice(0, 180);
    if (!cleanText) return;
    addMessage({ id: Date.now() + '-' + socket.id, fromId: socket.id, name: user.name, text: cleanText, role: 'listener', time: now });
  });

  socket.on('admin-message', ({ text, to }) => {
    if (socket.id !== adminSocketId) return;
    const cleanText = String(text || '').trim().slice(0, 220);
    if (!cleanText) return;
    const message = { id: Date.now() + '-admin', fromId: socket.id, name: 'ADMIN', text: cleanText, role: 'admin', private: Boolean(to), to: to || null, time: Date.now() };
    if (to) {
      io.to(to).emit('chat-message', message);
      socket.emit('chat-message', message);
    } else {
      addMessage(message);
    }
  });

  socket.on('moderate-user', ({ userId, action }) => {
    if (socket.id !== adminSocketId) return;
    const target = users.get(userId);
    if (!target) return;
    const now = Date.now();

    if (action === 'mute') {
      mutedUntil.set(userId, now + 10 * 60 * 1000);
      io.to(userId).emit('chat-error', 'Voce foi silenciado por 10 minutos.');
    }
    if (action === 'kick') {
      kickedUntil.set(userId, now + 10 * 60 * 1000);
      io.to(userId).emit('moderated', { action: 'kick', message: 'Voce foi expulso do chat por 10 minutos.' });
      users.delete(userId);
    }
    if (action === 'ban') {
      bannedUsers.add(userId);
      io.to(userId).emit('moderated', { action: 'ban', message: 'Voce foi banido do chat.' });
      users.delete(userId);
    }
    emitStatus();
  });

  socket.on('disconnect', () => {
    if (socket.id === adminSocketId) {
      adminSocketId = null;
      tvLive = false;
      radioLive = false;
      io.emit('live-ended', { type: 'all' });
    }

    listeners.delete(socket.id);
    users.delete(socket.id);
    if (adminSocketId) io.to(adminSocketId).emit('listener-disconnected', socket.id);
    emitStatus();
  });
});

server.listen(PORT, () => {
  console.log(`ACDSFM rodando em http://localhost:${PORT}`);
  console.log(`Painel admin: http://localhost:${PORT}/admin`);
  console.log(`Senha admin padrao: ${ADMIN_PASSWORD}`);
});
