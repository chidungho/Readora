const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getSocketCorsOrigins,
  registerSocketConnectionLogs,
} = require('../src/config/socket');

const withClientOrigin = (value, callback) => {
  const previous = process.env.CLIENT_ORIGIN;

  if (value === undefined) {
    delete process.env.CLIENT_ORIGIN;
  } else {
    process.env.CLIENT_ORIGIN = value;
  }

  try {
    callback();
  } finally {
    if (previous === undefined) {
      delete process.env.CLIENT_ORIGIN;
    } else {
      process.env.CLIENT_ORIGIN = previous;
    }
  }
};

test('Socket.IO CORS origins include both Vite dev hostnames', () => {
  withClientOrigin(undefined, () => {
    assert.deepEqual(getSocketCorsOrigins(), [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });
});

test('Socket.IO CORS origins preserve custom CLIENT_ORIGIN values', () => {
  withClientOrigin('http://custom.local:5173', () => {
    assert.deepEqual(getSocketCorsOrigins(), [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://custom.local:5173',
    ]);
  });
});

test('Socket.IO connection logging records connect, user room join, and disconnect events', () => {
  let connectionHandler;
  let disconnectHandler;
  let userJoinHandler;
  const joinedRooms = [];
  const logs = [];
  const originalLog = console.log;

  const io = {
    on(eventName, handler) {
      if (eventName === 'connection') {
        connectionHandler = handler;
      }
    },
  };
  const socket = {
    id: 'socket-123',
    on(eventName, handler) {
      if (eventName === 'disconnect') {
        disconnectHandler = handler;
      }

      if (eventName === 'user:join') {
        userJoinHandler = handler;
      }
    },
    join(room) {
      joinedRooms.push(room);
    },
  };

  console.log = (...args) => {
    logs.push(args);
  };

  try {
    registerSocketConnectionLogs(io);
    connectionHandler(socket);
    userJoinHandler({ userId: 'user-1' });
    disconnectHandler('client namespace disconnect');
  } finally {
    console.log = originalLog;
  }

  assert.deepEqual(joinedRooms, ['user:user-1']);
  assert.deepEqual(logs, [
    ['socket connected', 'socket-123'],
    ['socket disconnected', 'socket-123', 'client namespace disconnect'],
  ]);
});
