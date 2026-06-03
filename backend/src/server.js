const path = require('node:path');
const http = require('node:http');
const { Server } = require('socket.io');

require("dotenv").config({
  path: path.resolve(__dirname, '../.env'),
  override: process.env.NODE_ENV !== 'production',
});

const app = require('./app');
const connectDB = require('./config/db');
const {
  getSocketCorsOrigins,
  registerSocketConnectionLogs,
} = require('./config/socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: getSocketCorsOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  app.set('io', io);
  registerSocketConnectionLogs(io);

  httpServer.listen(PORT, () => {
    console.log(`Readora API server is running on port ${PORT}`);
  });
};

startServer();
