const path = require('node:path');
const http = require('node:http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

require("dotenv").config({
  path: path.resolve(__dirname, '../.env'),
});

const app = require('./app');
const connectDB = require('./config/db');
const {
  getSocketCorsOrigins,
  registerSocketConnectionLogs,
} = require('./config/socket');

const PORT = process.env.PORT || 5000;
let httpServer;
let io;
let isShuttingDown = false;

const handleServerError = (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the process using it or set a different PORT in .env.`,
    );
    process.exit(1);
  }

  throw error;
};

const startServer = async () => {
  await connectDB();

  httpServer = http.createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: getSocketCorsOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  app.set('io', io);
  registerSocketConnectionLogs(io);

  httpServer.on('error', handleServerError);

  httpServer.listen(PORT, () => {
    console.log(`Readora API server is running on port ${PORT}`);
  });
};

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down server...`);

  try {
    if (io) {
      io.close();
    }

    if (httpServer?.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  } catch (error) {
    console.error('Error during server shutdown:', error);
    process.exit(1);
  }
};

process.once('SIGINT', async () => {
  await shutdown('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', async () => {
  await shutdown('SIGTERM');
  process.exit(0);
});


startServer();
