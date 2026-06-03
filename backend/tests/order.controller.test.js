const assert = require('node:assert/strict');
const test = require('node:test');

const loadOrder = () => require('../src/models/order.model');
const loadOrderController = () => require('../src/controllers/order.controller');

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
  const Order = loadOrder();
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

const shippingAddress = {
  fullName: 'Nguyen Van A',
  phone: '0909123456',
  address: '12 Nguyen Trai',
  city: 'Ha Noi',
};

const cartItems = [
  {
    book: '507f1f77bcf86cd799439011',
    title: 'Clean Code',
    price: 120000,
    quantity: 2,
    coverImage: '/clean-code.jpg',
  },
];

test('Order schema uses requested fields, defaults, and timestamps', () => {
  const Order = loadOrder();

  assert.equal(Order.schema.path('user').isRequired, true);
  assert.equal(Order.schema.path('user').options.ref, 'User');
  assert.equal(Order.schema.path('items.book').isRequired, true);
  assert.equal(Order.schema.path('items.book').options.ref, 'Book');
  assert.equal(Order.schema.path('items.title').isRequired, true);
  assert.equal(Order.schema.path('items.price').isRequired, true);
  assert.equal(Order.schema.path('items.quantity').isRequired, true);
  assert.equal(Order.schema.path('shippingAddress.fullName').isRequired, true);
  assert.equal(Order.schema.path('shippingAddress.phone').isRequired, true);
  assert.equal(Order.schema.path('shippingAddress.address').isRequired, true);
  assert.equal(Order.schema.path('shippingAddress.city').isRequired, true);
  assert.equal(Order.schema.path('totalAmount').isRequired, true);
  assert.equal(Order.schema.path('orderCode').isRequired, true);
  assert.equal(Order.schema.path('paymentProvider').instance, 'String');
  assert.equal(Order.schema.path('paymentTransactionId').instance, 'String');
  assert.equal(Order.schema.path('paidAt').instance, 'Date');
  assert.equal(Order.schema.path('paymentNote').instance, 'String');
  assert.equal(Order.schema.path('cancelledAt').instance, 'Date');
  assert.equal(Order.schema.path('cancelReason').instance, 'String');
  assert.deepEqual(Order.schema.path('status').enumValues, [
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
  ]);

  const doc = new Order({
    user: '507f1f77bcf86cd799439012',
    items: cartItems,
    shippingAddress,
    orderCode: 'ABC123',
    totalAmount: 240000,
  });

  assert.equal(doc.status, 'pending');
  assert.deepEqual(Order.schema.path('paymentMethod').enumValues, ['cod', 'bank_transfer']);
  assert.deepEqual(Order.schema.path('paymentStatus').enumValues, ['unpaid', 'paid']);
  assert.equal(doc.paymentMethod, 'cod');
  assert.equal(doc.paymentStatus, 'unpaid');
  assert.equal(doc.paymentProvider, '');
  assert.equal(doc.paymentTransactionId, '');
  assert.equal(doc.paidAt, null);
  assert.equal(doc.paymentNote, '');
  assert.equal(Order.schema.options.timestamps, true);
});

test('Order controller exports createOrder, getMyOrders, getOrderById, and cancelOrder', () => {
  const orderController = loadOrderController();

  for (const handler of ['createOrder', 'getMyOrders', 'getOrderById', 'cancelOrder']) {
    assert.equal(typeof orderController[handler], 'function');
  }
});

test('createOrder returns 400 when cart items are missing', async () => {
  const orderController = loadOrderController();
  const res = await callController(orderController.createOrder, {
    user: { _id: 'user-1' },
    body: { items: [], shippingAddress },
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    success: false,
    message: 'Order must have at least one item',
  });
});

test('createOrder saves the authenticated user, cart items, address, and total', async () => {
  const orderController = loadOrderController();
  const createdOrder = {
    _id: 'order-1',
    user: 'user-1',
    items: cartItems,
    shippingAddress,
    totalAmount: 240000,
    status: 'pending',
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
  };

  await withMockedOrderMethod('create', async (data) => {
    assert.match(data.orderCode, /^[A-Z0-9]+$/);
    assert.deepEqual(data, {
      user: 'user-1',
      items: cartItems,
      shippingAddress,
      orderCode: data.orderCode,
      totalAmount: 240000,
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
    });

    return createdOrder;
  }, async () => {
    const res = await callController(orderController.createOrder, {
      user: { _id: 'user-1' },
      body: { items: cartItems, shippingAddress },
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Order created successfully',
      data: createdOrder,
    });
  });
});

test('createOrder saves bank transfer orders as unpaid', async () => {
  const orderController = loadOrderController();
  const createdOrder = {
    _id: 'order-bank-1',
    user: 'user-1',
    items: cartItems,
    shippingAddress,
    totalAmount: 240000,
    status: 'pending',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'unpaid',
  };

  await withMockedOrderMethod('create', async (data) => {
    assert.match(data.orderCode, /^[A-Z0-9]+$/);
    assert.deepEqual(data, {
      user: 'user-1',
      items: cartItems,
      shippingAddress,
      orderCode: data.orderCode,
      totalAmount: 240000,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'unpaid',
    });

    return createdOrder;
  }, async () => {
    const res = await callController(orderController.createOrder, {
      user: { _id: 'user-1' },
      body: { items: cartItems, shippingAddress, paymentMethod: 'bank_transfer' },
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.payload.data, createdOrder);
  });
});

test('createOrder returns 400 for invalid payment method', async () => {
  const orderController = loadOrderController();

  await withMockedOrderMethod('create', async () => {
    throw new Error('Order.create should not be called');
  }, async () => {
    const res = await callController(orderController.createOrder, {
      user: { _id: 'user-1' },
      body: { items: cartItems, shippingAddress, paymentMethod: 'momo' },
    });

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Invalid payment method',
    });
  });
});

test('getMyOrders returns only orders for the authenticated user', async () => {
  const orderController = loadOrderController();
  const orders = [{ _id: 'order-1', user: 'user-1' }];

  await withMockedOrderMethod('find', (query) => {
    assert.deepEqual(query, { user: 'user-1' });

    return {
      sort(sortQuery) {
        assert.deepEqual(sortQuery, { createdAt: -1 });
        return Promise.resolve(orders);
      },
    };
  }, async () => {
    const res = await callController(orderController.getMyOrders, {
      user: { _id: 'user-1' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
    });
  });
});

test('getOrderById returns 404 when the order does not belong to the user', async () => {
  const orderController = loadOrderController();

  await withMockedOrderMethod('findOne', async (query) => {
    assert.deepEqual(query, {
      _id: 'order-404',
      user: 'user-1',
    });

    return null;
  }, async () => {
    const res = await callController(orderController.getOrderById, {
      user: { _id: 'user-1' },
      params: { id: 'order-404' },
    });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Order not found',
    });
  });
});

test('getOrderById returns one order for the authenticated user', async () => {
  const orderController = loadOrderController();
  const order = { _id: 'order-1', user: 'user-1' };

  await withMockedOrderMethod('findOne', async (query) => {
    assert.deepEqual(query, {
      _id: 'order-1',
      user: 'user-1',
    });

    return order;
  }, async () => {
    const res = await callController(orderController.getOrderById, {
      user: { _id: 'user-1' },
      params: { id: 'order-1' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Order fetched successfully',
      data: order,
    });
  });
});

test('cancelOrder cancels a pending order that belongs to the authenticated user', async () => {
  const orderController = loadOrderController();
  const order = {
    _id: 'order-1',
    user: 'user-1',
    status: 'pending',
    cancelledAt: null,
    cancelReason: '',
    async save() {
      return this;
    },
  };

  await withMockedOrderMethod('findOne', async (query) => {
    assert.deepEqual(query, {
      _id: 'order-1',
      user: 'user-1',
    });

    return order;
  }, async () => {
    const beforeCancel = Date.now();
    const res = await callController(orderController.cancelOrder, {
      user: { _id: 'user-1' },
      params: { id: 'order-1' },
      body: { cancelReason: ' Dat nham sach ' },
    });
    const afterCancel = Date.now();

    assert.equal(order.status, 'cancelled');
    assert.equal(order.cancelReason, 'Dat nham sach');
    assert.equal(typeof order.cancelledAt, 'number');
    assert.ok(order.cancelledAt >= beforeCancel);
    assert.ok(order.cancelledAt <= afterCancel);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Đã hủy đơn hàng',
      data: order,
    });
  });
});

test('cancelOrder does not cancel shipped orders', async () => {
  const orderController = loadOrderController();
  const order = {
    _id: 'order-1',
    user: 'user-1',
    status: 'shipped',
    async save() {
      throw new Error('save should not be called');
    },
  };

  await withMockedOrderMethod('findOne', async (query) => {
    assert.deepEqual(query, {
      _id: 'order-1',
      user: 'user-1',
    });

    return order;
  }, async () => {
    const res = await callController(orderController.cancelOrder, {
      user: { _id: 'user-1' },
      params: { id: 'order-1' },
      body: {},
    });

    assert.equal(order.status, 'shipped');
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Không thể hủy đơn hàng ở trạng thái hiện tại',
    });
  });
});
