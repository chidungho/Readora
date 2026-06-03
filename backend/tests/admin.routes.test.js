const assert = require('node:assert/strict');
const test = require('node:test');

const findRoute = (router, path, method) =>
  router.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);

test('Admin routes expose books and orders behind admin middleware', () => {
  const router = require('../src/routes/admin.routes');
  const adminLayer = router.stack.find((layer) => layer.handle.name === 'adminMiddleware');
  const expectedRoutes = [
    { path: '/books', method: 'get', handlers: ['getBooks'] },
    { path: '/books', method: 'post', handlers: ['createBook'] },
    { path: '/books/:id', method: 'put', handlers: ['updateBook'] },
    { path: '/books/:id', method: 'delete', handlers: ['deleteBook'] },
    { path: '/orders', method: 'get', handlers: ['getAdminOrders'] },
    { path: '/orders/:id/status', method: 'patch', handlers: ['updateAdminOrderStatus'] },
  ];

  assert.ok(adminLayer, 'adminMiddleware is missing from admin router');

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

test('App mounts admin routes at /api/admin and protects them with auth', async () => {
  const { response, payload } = await requestApp('/api/admin/books');

  assert.equal(response.status, 401);
  assert.deepEqual(payload, {
    success: false,
    message: 'Authentication token is required',
  });
});
