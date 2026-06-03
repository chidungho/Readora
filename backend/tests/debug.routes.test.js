const assert = require('node:assert/strict');
const test = require('node:test');

const requestApp = async (path, options = {}) => {
  const app = require('../src/app');
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const payload = await response.json();

    return { response, payload, app };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
};

test('Debug socket test route emits admin:new-review globally', async () => {
  const app = require('../src/app');
  const emittedEvents = [];

  app.set('io', {
    emit(eventName, payload) {
      emittedEvents.push({ eventName, payload });
    },
  });

  try {
    const { response, payload } = await requestApp('/api/debug/socket-test');

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.message, 'Debug socket review notification emitted');
    assert.deepEqual(emittedEvents, [
      {
        eventName: 'admin:new-review',
        payload: payload.data,
      },
    ]);
    assert.equal(payload.data.type, 'review');
    assert.equal(payload.data.bookTitle, 'Debug Socket Test');
    assert.equal(payload.data.userName, 'Debug User');
    assert.equal(payload.data.rating, 5);
    assert.equal(payload.data.comment, 'Socket test event');
    assert.match(payload.data.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    app.set('io', undefined);
  }
});
