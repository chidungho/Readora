const assert = require('node:assert/strict');
const test = require('node:test');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../src/models/user.model');
const googleAuthService = require('../src/services/googleAuth.service');
const authController = require('../src/controllers/auth.controller');
const authMiddleware = require('../src/middlewares/auth.middleware');

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

const callController = async (handler, req = {}) => {
  const res = mockResponse();
  let nextError;

  await handler(req, res, (error) => {
    nextError = error;
  });

  if (nextError) {
    throw nextError;
  }

  return res;
};

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


const withMockedGoogleVerify = async (mockFn, action) => {
  const originalVerify = googleAuthService.verifyGoogleIdToken;
  googleAuthService.verifyGoogleIdToken = mockFn;

  try {
    return await action();
  } finally {
    googleAuthService.verifyGoogleIdToken = originalVerify;
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

test('User schema uses requested fields, role default, and timestamps', () => {
  const requiredFields = ['name', 'email', 'password'];

  for (const field of requiredFields) {
    assert.equal(User.schema.path(field).isRequired, true);
  }

  assert.equal(User.schema.path('email').options.unique, true);
  assert.equal(User.schema.path('email').options.lowercase, true);
  assert.equal(User.schema.path('email').options.trim, true);
  assert.deepEqual(User.schema.path('role').enumValues, ['user', 'admin']);

  const doc = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'secret123',
  });

  assert.equal(doc.role, 'user');
  assert.ok(User.schema.path('avatar'));
  assert.equal(User.schema.options.timestamps, true);
});

test('Auth controller exports register, login, googleLogin, and getProfile', () => {
  for (const handler of ['register', 'login', 'googleLogin', 'getProfile']) {
    assert.equal(typeof authController[handler], 'function');
  }
});

test('register returns 400 when a required field is missing', async () => {
  const res = await callController(authController.register, {
    body: { name: 'Test User', email: 'test@example.com' },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    success: false,
    message: 'Name, email and password are required',
  });
});

test('register hashes password and returns token with user data', async () => {
  const plainPassword = 'secret123';
  const createdUser = {
    _id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    avatar: '',
    password: 'will-be-overwritten',
    toObject() {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        avatar: this.avatar,
        password: this.password,
      };
    },
  };
  let receivedCreateData;

  await withJwtSecret('test-secret', async () => {
    await withMockedUserMethod('findOne', async (query) => {
      assert.deepEqual(query, { email: 'test@example.com' });
      return null;
    }, async () => {
      await withMockedUserMethod('create', async (data) => {
        receivedCreateData = data;
        createdUser.password = data.password;
        return createdUser;
      }, async () => {
        const res = await callController(authController.register, {
          body: {
            name: 'Test User',
            email: 'test@example.com',
            password: plainPassword,
          },
        });

        assert.equal(res.statusCode, 201);
        assert.equal(await bcrypt.compare(plainPassword, receivedCreateData.password), true);
        assert.notEqual(receivedCreateData.password, plainPassword);
        assert.equal(res.payload.success, true);
        assert.equal(res.payload.data.user.password, undefined);
        assert.equal(res.payload.data.user.email, 'test@example.com');
        assert.equal(jwt.verify(res.payload.data.token, 'test-secret').id, 'user-1');
      });
    });
  });
});

test('login compares password and returns token with user data', async () => {
  const hashedPassword = await bcrypt.hash('secret123', 10);
  const foundUser = {
    _id: 'user-2',
    name: 'Login User',
    email: 'login@example.com',
    role: 'user',
    password: hashedPassword,
    toObject() {
      return {
        _id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        password: this.password,
      };
    },
  };

  await withJwtSecret('test-secret', async () => {
    await withMockedUserMethod('findOne', async (query) => {
      assert.deepEqual(query, { email: 'login@example.com' });
      return foundUser;
    }, async () => {
      const res = await callController(authController.login, {
        body: { email: 'login@example.com', password: 'secret123' },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.success, true);
      assert.equal(res.payload.data.user.password, undefined);
      assert.equal(res.payload.data.user.name, 'Login User');
      assert.equal(jwt.verify(res.payload.data.token, 'test-secret').id, 'user-2');
    });
  });
});

test('login returns 401 for an invalid password', async () => {
  const hashedPassword = await bcrypt.hash('secret123', 10);

  await withMockedUserMethod('findOne', async () => ({
    email: 'login@example.com',
    password: hashedPassword,
  }), async () => {
    const res = await callController(authController.login, {
      body: { email: 'login@example.com', password: 'wrong-password' },
    });

    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Invalid email or password',
    });
  });
});


test('googleLogin creates a user when Google email does not exist', async () => {
  const createdUser = {
    _id: 'google-user-1',
    name: 'Google User',
    email: 'google@example.com',
    role: 'user',
    avatar: 'https://example.com/avatar.png',
    password: 'hashed-google-password',
    toObject() {
      return { ...this };
    },
  };
  let receivedCreateData;

  await withJwtSecret('test-secret', async () => {
    await withMockedGoogleVerify(async (idToken) => {
      assert.equal(idToken, 'google-id-token');
      return {
        email: 'Google@Example.com',
        name: 'Google User',
        avatar: 'https://example.com/avatar.png',
      };
    }, async () => {
      await withMockedUserMethod('findOne', async (query) => {
        assert.deepEqual(query, { email: 'google@example.com' });
        return null;
      }, async () => {
        await withMockedUserMethod('create', async (data) => {
          receivedCreateData = data;
          return createdUser;
        }, async () => {
          const res = await callController(authController.googleLogin, {
            body: { idToken: 'google-id-token' },
          });

          assert.equal(res.statusCode, 200);
          assert.equal(res.payload.success, true);
          assert.equal(receivedCreateData.email, 'google@example.com');
          assert.equal(receivedCreateData.name, 'Google User');
          assert.equal(receivedCreateData.avatar, 'https://example.com/avatar.png');
          assert.ok(receivedCreateData.password.startsWith('$2'));
          assert.equal(res.payload.data.user.password, undefined);
          assert.equal(jwt.verify(res.payload.data.token, 'test-secret').id, 'google-user-1');
        });
      });
    });
  });
});

test('googleLogin logs in an existing user without creating a duplicate', async () => {
  const foundUser = {
    _id: 'google-user-2',
    name: 'Existing User',
    email: 'existing@example.com',
    role: 'user',
    password: 'hashed-password',
    toObject() {
      return { ...this };
    },
  };

  await withJwtSecret('test-secret', async () => {
    await withMockedGoogleVerify(async () => ({
      email: 'existing@example.com',
      name: 'Google Name',
      avatar: '',
    }), async () => {
      await withMockedUserMethod('findOne', async (query) => {
        assert.deepEqual(query, { email: 'existing@example.com' });
        return foundUser;
      }, async () => {
        await withMockedUserMethod('create', async () => {
          throw new Error('User.create should not be called');
        }, async () => {
          const res = await callController(authController.googleLogin, {
            body: { idToken: 'google-id-token' },
          });

          assert.equal(res.statusCode, 200);
          assert.equal(res.payload.data.user.email, 'existing@example.com');
          assert.equal(res.payload.data.user.password, undefined);
          assert.equal(jwt.verify(res.payload.data.token, 'test-secret').id, 'google-user-2');
        });
      });
    });
  });
});

test('googleLogin returns 400 when idToken is missing', async () => {
  const res = await callController(authController.googleLogin, { body: {} });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    success: false,
    message: 'Google ID token is required',
  });
});

test('getProfile returns the authenticated user from req.user', async () => {
  const user = { _id: 'user-3', name: 'Profile User', email: 'profile@example.com' };
  const res = await callController(authController.getProfile, { user });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, {
    success: true,
    message: 'Profile fetched successfully',
    data: { user },
  });
});

test('auth middleware verifies Bearer token and attaches req.user', async () => {
  const token = jwt.sign({ id: 'user-4' }, 'test-secret');
  const safeUser = { _id: 'user-4', name: 'Safe User', email: 'safe@example.com' };

  await withJwtSecret('test-secret', async () => {
    await withMockedUserMethod('findById', (id) => {
      assert.equal(id, 'user-4');

      return {
        select(selection) {
          assert.equal(selection, '-password');
          return Promise.resolve(safeUser);
        },
      };
    }, async () => {
      const { req, res, nextWasCalled } = await callMiddleware(authMiddleware, {
        headers: { authorization: `Bearer ${token}` },
      });

      assert.equal(res.payload, null);
      assert.equal(nextWasCalled, true);
      assert.deepEqual(req.user, safeUser);
    });
  });
});

test('auth middleware rejects missing token', async () => {
  const { res, nextWasCalled } = await callMiddleware(authMiddleware, {
    headers: {},
  });

  assert.equal(nextWasCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, {
    success: false,
    message: 'Authentication token is required',
  });
});
