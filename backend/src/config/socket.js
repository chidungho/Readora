const jwt = require('jsonwebtoken');

const DEFAULT_SOCKET_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const getSocketCorsOrigins = () => {
  const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_SOCKET_ORIGINS, ...configuredOrigins])];
};


const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return process.env.JWT_SECRET;
};

const getSocketUserId = (socket) => {
  const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;

  if (!token) {
    return '';
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return String(decoded.id || '').trim();
  } catch (error) {
    console.warn('socket auth failed', socket.id, error.message);
    return '';
  }
};

const registerSocketConnectionLogs = (io) => {
  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    const authenticatedUserId = getSocketUserId(socket);

    if (authenticatedUserId) {
      socket.join(`user:${authenticatedUserId}`);
    }

    socket.on('user:join', (payload) => {
      const userId = payload?.userId || payload;
      const normalizedUserId = String(userId || '').trim();

      if (normalizedUserId) {
        socket.join(`user:${normalizedUserId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('socket disconnected', socket.id, reason);
    });
  });
};

module.exports = {
  getSocketCorsOrigins,
  registerSocketConnectionLogs,
};
