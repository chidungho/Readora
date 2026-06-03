const assert = require('node:assert/strict');
const test = require('node:test');

test('Review routes are mounted as sub-routes under book routes', () => {
  const bookRouter = require('../src/routes/book.routes');

  // Find the sub-router (layer with handle.stack and path is middleware)
  const reviewLayer = bookRouter.stack.find(
    (layer) => layer.handle && layer.handle.stack && !layer.route,
  );

  assert.ok(reviewLayer, 'Review sub-router must be mounted as middleware in book router');

  const reviewRouter = reviewLayer.handle;
  const routes = reviewRouter.stack.map((layer) => ({
    path: layer.route?.path,
    methods: layer.route?.methods ? Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]) : [],
    name: layer.route?.stack?.[0]?.handle?.name || (layer.route?.stack && layer.route.stack.length > 1 ? layer.route.stack[1].handle.name : ''),
  }));

  const getRoute = routes.find((r) => r.path === '/' && r.methods.includes('get'));
  const postRoute = routes.find((r) => r.path === '/' && r.methods.includes('post'));

  assert.ok(getRoute, 'GET / route is missing in review sub-router');
  assert.ok(postRoute, 'POST / route is missing in review sub-router');
});

test('POST review route includes auth middleware', () => {
  const bookRouter = require('../src/routes/book.routes');
  const reviewLayer = bookRouter.stack.find(
    (layer) => layer.handle && layer.handle.stack && !layer.route,
  );

  assert.ok(reviewLayer, 'Review sub-router must exist');

  const reviewRouter = reviewLayer.handle;
  const postLayer = reviewRouter.stack.find(
    (layer) => layer.route?.path === '/' && layer.route?.methods?.post,
  );

  assert.ok(postLayer, 'POST / route must exist');
  assert.ok(postLayer.route, 'POST / must have route object');

  const handlerNames = postLayer.route.stack.map((s) => s.handle.name);

  assert.ok(
    handlerNames.includes('authMiddleware'),
    'POST /books/:bookId/reviews must use auth middleware',
  );
  assert.ok(
    handlerNames.includes('createBookReview'),
    'POST /books/:bookId/reviews must use createBookReview handler',
  );
});

test('GET review route does not include auth middleware', () => {
  const bookRouter = require('../src/routes/book.routes');
  const reviewLayer = bookRouter.stack.find(
    (layer) => layer.handle && layer.handle.stack && !layer.route,
  );

  assert.ok(reviewLayer, 'Review sub-router must exist');

  const reviewRouter = reviewLayer.handle;
  const getLayer = reviewRouter.stack.find(
    (layer) => layer.route?.path === '/' && layer.route?.methods?.get,
  );

  assert.ok(getLayer, 'GET / route must exist');

  const handlerNames = getLayer.route.stack.map((s) => s.handle.name);

  assert.ok(
    handlerNames.includes('getBookReviews'),
    'GET /books/:bookId/reviews must use getBookReviews handler',
  );
  assert.ok(
    !handlerNames.includes('authMiddleware'),
    'GET /books/:bookId/reviews should NOT require auth',
  );
});
