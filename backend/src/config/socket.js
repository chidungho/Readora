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

const registerSocketConnectionLogs = (io) => {
  io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on('disconnect', (reason) => {
      console.log('socket disconnected', socket.id, reason);
    });
  });
};

module.exports = {
  getSocketCorsOrigins,
  registerSocketConnectionLogs,
};
