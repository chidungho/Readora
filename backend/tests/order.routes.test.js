const assert = require('node:assert/strict');
const test = require('node:test');

const findRoute = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);

test('Order routes expose create, my orders, and order detail behind auth middleware', () => {
  const router = require('../src/routes/order.routes');
  const expectedRoutes = [
    { path: '/', method: 'post', handlers: ['authMiddleware', 'createOrder'] },
    { path: '/my', method: 'get', handlers: ['authMiddleware', 'getMyOrders'] },
    { path: '/:id/cancel', method: 'patch', handlers: ['authMiddleware', 'cancelOrder'] },
    { path: '/:id', method: 'get', handlers: ['authMiddleware', 'getOrderById'] },
  ];

  for (const expectedRoute of expectedRoutes) {
    const route = findRoute(router, expectedRoute.path, expectedRoute.method);

    assert.ok(route, `${expectedRoute.method.toUpperCase()} ${expectedRoute.path} is missing`);
    assert.deepEqual(
      route.route.stack.map((stackItem) => stackItem.handle.name),
      expectedRoute.handlers,
    );
  }
});

const requestApp = async (path, options = {}) => {
  const app = require('../src/app');
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const payload = await response.json();

    return { response, payload };
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

test('App mounts order routes at /api/orders and protects them with auth', async () => {
  const { response, payload } = await requestApp('/api/orders/my');

  assert.equal(response.status, 401);
  assert.deepEqual(payload, {
    success: false,
    message: 'Authentication token is required',
  });
});
