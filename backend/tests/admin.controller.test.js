const assert = require('node:assert/strict');
const test = require('node:test');

const Order = require('../src/models/order.model');
const adminController = require('../src/controllers/admin.controller');

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

const withMockedOrderMethod = async (methodName, mockFn, action) => {
  const hadOwnMethod = Object.prototype.hasOwnProperty.call(Order, methodName);
  const originalMethod = Order[methodName];

  Order[methodName] = mockFn;

  try {
    return await action();
  } finally {
    if (hadOwnMethod) {
      Order[methodName] = originalMethod;
    } else {
      delete Order[methodName];
    }
  }
};

test('Admin controller exports order handlers', () => {
  assert.equal(typeof adminController.getAdminOrders, 'function');
  assert.equal(typeof adminController.updateAdminOrderStatus, 'function');
});

test('getAdminOrders returns all orders sorted newest first with user info', async () => {
  const orders = [
    {
      _id: 'order-1',
      user: { name: 'Nguyen Van A', email: 'a@example.com' },
      status: 'pending',
    },
  ];

  await withMockedOrderMethod('find', (query) => {
    assert.deepEqual(query, {});

    return {
      populate(path, fields) {
        assert.equal(path, 'user');
        assert.equal(fields, 'name email');
        return this;
      },
      sort(sortQuery) {
        assert.deepEqual(sortQuery, { createdAt: -1 });
        return Promise.resolve(orders);
      },
    };
  }, async () => {
    const res = await callController(adminController.getAdminOrders);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
    });
  });
});

test('updateAdminOrderStatus rejects status outside the allowed list', async () => {
  const res = await callController(adminController.updateAdminOrderStatus, {
    params: { id: 'order-1' },
    body: { status: 'paid' },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    success: false,
    message: 'Invalid order status',
  });
});

test('updateAdminOrderStatus updates order status and returns the order', async () => {
  const updatedOrder = {
    _id: 'order-1',
    status: 'shipped',
  };

  await withMockedOrderMethod('findByIdAndUpdate', async (id, updateData, options) => {
    assert.equal(id, 'order-1');
    assert.deepEqual(updateData, {
      status: 'shipped',
      cancelledAt: null,
    });
    assert.deepEqual(options, {
      new: true,
      runValidators: true,
    });

    return updatedOrder;
  }, async () => {
    const res = await callController(adminController.updateAdminOrderStatus, {
      params: { id: 'order-1' },
      body: { status: 'shipped' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder,
    });
  });
});

test('updateAdminOrderStatus returns 404 when order is not found', async () => {
  await withMockedOrderMethod('findByIdAndUpdate', async () => null, async () => {
    const res = await callController(adminController.updateAdminOrderStatus, {
      params: { id: 'missing-order' },
      body: { status: 'delivered' },
    });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Order not found',
    });
  });
});
