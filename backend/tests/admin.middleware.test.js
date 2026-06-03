const assert = require('node:assert/strict');
const test = require('node:test');

const jwt = require('jsonwebtoken');

const User = require('../src/models/user.model');
const adminMiddleware = require('../src/middlewares/admin.middleware');

const mockResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const callMiddleware = async (handler, req = {}) => {
  const res = mockResponse();
  let nextWasCalled = false;
  let nextError;

  await handler(req, res, (error) => {
    nextWasCalled = true;
    nextError = error;
  });

  if (nextError) {
    throw nextError;
  }

  return { req, res, nextWasCalled };
};

const withMockedUserMethod = async (methodName, mockFn, action) => {
  const hadOwnMethod = Object.prototype.hasOwnProperty.call(User, methodName);
  const originalMethod = User[methodName];

  User[methodName] = mockFn;

  try {
    return await action();
  } finally {
    if (hadOwnMethod) {
      User[methodName] = originalMethod;
    } else {
      delete User[methodName];
    }
  }
};

const withJwtSecret = async (value, action) => {
  const originalValue = process.env.JWT_SECRET;
  process.env.JWT_SECRET = value;

  try {
    return await action();
  } finally {
    if (originalValue === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalValue;
    }
  }
};

test('admin middleware verifies token and allows admin users', async () => {
  const token = jwt.sign({ id: 'admin-1' }, 'test-secret');
  const adminUser = {
    _id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
  };

  await withJwtSecret('test-secret', async () => {
    await withMockedUserMethod('findById', (id) => {
      assert.equal(id, 'admin-1');

      return {
        select(selection) {
          assert.equal(selection, '-password');
          return Promise.resolve(adminUser);
        },
      };
    }, async () => {
      const { req, res, nextWasCalled } = await callMiddleware(adminMiddleware, {
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(nextWasCalled, true);
      assert.equal(res.payload, null);
      assert.deepEqual(req.user, adminUser);
    });
  });
});

test('admin middleware rejects logged-in users without admin role', async () => {
  const token = jwt.sign({ id: 'user-1' }, 'test-secret');
  const normalUser = {
    _id: 'user-1',
    name: 'Normal User',
    email: 'user@example.com',
    role: 'user',
  };

  await withJwtSecret('test-secret', async () => {
    await withMockedUserMethod('findById', () => ({
      select() {
        return Promise.resolve(normalUser);
      },
    }), async () => {
      const { res, nextWasCalled } = await callMiddleware(adminMiddleware, {
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(nextWasCalled, false);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.payload, {
        success: false,
        message: 'Admin access is required',
      });
    });
  });
});
