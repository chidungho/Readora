const assert = require('node:assert/strict');
const test = require('node:test');

const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const app = require('../src/app');
const User = require('../src/models/user.model');

const createToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

const withMockedUser = async (user, action) => {
  const originalFindById = User.findById;

  User.findById = () => ({
    select: async () => user,
  });

  try {
    return await action();
  } finally {
    User.findById = originalFindById;
  }
};

test('book cover upload requires admin authentication', async () => {
  const response = await request(app)
    .post('/api/admin/uploads/book-cover')
    .attach('cover', Buffer.from('not an image'), 'cover.txt');

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});

test('book cover upload rejects non-admin users', async () => {
  await withMockedUser({ _id: 'user-1', role: 'user' }, async () => {
    const response = await request(app)
      .post('/api/admin/uploads/book-cover')
      .set('Authorization', `Bearer ${createToken('user-1')}`)
      .attach('cover', Buffer.from('not an image'), 'cover.txt');

    assert.equal(response.status, 403);
    assert.equal(response.body.success, false);
  });
});

test('book cover upload rejects non-image files for admins', async () => {
  await withMockedUser({ _id: 'admin-1', role: 'admin' }, async () => {
    const response = await request(app)
      .post('/api/admin/uploads/book-cover')
      .set('Authorization', `Bearer ${createToken('admin-1')}`)
      .attach('cover', Buffer.from('plain text'), 'cover.txt');

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /JPEG|PNG|WEBP/);
  });
});

test('book cover upload rejects files over 5MB for admins', async () => {
  await withMockedUser({ _id: 'admin-1', role: 'admin' }, async () => {
    const oversizedImage = Buffer.alloc(5 * 1024 * 1024 + 1);
    const response = await request(app)
      .post('/api/admin/uploads/book-cover')
      .set('Authorization', `Bearer ${createToken('admin-1')}`)
      .attach('cover', oversizedImage, {
        filename: 'cover.png',
        contentType: 'image/png',
      });

    assert.equal(response.status, 400);
    assert.equal(response.body.success, false);
    assert.match(response.body.message, /5MB/);
  });
});


test('book cover upload accepts image files for admins', async () => {
  await withMockedUser({ _id: 'admin-1', role: 'admin' }, async () => {
    const image = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89,
    ]);
    const response = await request(app)
      .post('/api/admin/uploads/book-cover')
      .set('Authorization', `Bearer ${createToken('admin-1')}`)
      .attach('cover', image, {
        filename: 'cover.png',
        contentType: 'image/png',
      });

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.match(response.body.url, /^\/uploads\/book-covers\/book-cover-/);
  });
});
