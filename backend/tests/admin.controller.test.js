const assert = require('node:assert/strict');
const test = require('node:test');

const Order = require('../src/models/order.model');
const Book = require('../src/models/book.model');
const Review = require('../src/models/review.model');
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

const expectedProcessableOrderQuery = {
  $or: [
    { paymentMethod: 'cod' },
    { paymentMethod: 'bank_transfer', paymentStatus: 'paid' },
  ],
};

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


const withMockedReviewMethod = async (methodName, mockFn, action) => {
  const hadOwnMethod = Object.prototype.hasOwnProperty.call(Review, methodName);
  const originalMethod = Review[methodName];

  Review[methodName] = mockFn;

  try {
    return await action();
  } finally {
    if (hadOwnMethod) {
      Review[methodName] = originalMethod;
    } else {
      delete Review[methodName];
    }
  }
};

const withMockedBookMethod = async (methodName, mockFn, action) => {
  const hadOwnMethod = Object.prototype.hasOwnProperty.call(Book, methodName);
  const originalMethod = Book[methodName];

  Book[methodName] = mockFn;

  try {
    return await action();
  } finally {
    if (hadOwnMethod) {
      Book[methodName] = originalMethod;
    } else {
      delete Book[methodName];
    }
  }
};

const createOrderDoc = (overrides = {}) => ({
  _id: 'order-1',
  status: 'pending',
  paymentStatus: 'unpaid',
  stockDeducted: true,
  stockRestored: false,
  items: [{ book: '507f1f77bcf86cd799439011', quantity: 2 }],
  async save() { return this; },
  ...overrides,
});

const createBookDoc = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  stock: 8,
  sold: 3,
  async save() { return this; },
  ...overrides,
});

test('Admin controller exports order handlers', () => {
  assert.equal(typeof adminController.getAdminOrders, 'function');
  assert.equal(typeof adminController.updateAdminOrderStatus, 'function');
  assert.equal(typeof adminController.getAdminReviews, 'function');
  assert.deepEqual(adminController.allowedPaymentStatuses, ['unpaid', 'paid']);
});

test('getAdminOrders returns only processable orders sorted newest first with user info', async () => {
  const orders = [
    {
      _id: 'order-1',
      user: { name: 'Nguyen Van A', email: 'a@example.com' },
      status: 'pending',
    },
  ];

  await withMockedOrderMethod('find', (query) => {
    assert.deepEqual(query, expectedProcessableOrderQuery);

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

test('updateAdminOrderStatus updates order status, emits realtime event, and returns the order', async () => {
  const updatedOrder = createOrderDoc({
    status: 'pending',
    user: { _id: 'user-1' },
    orderCode: 'ORD001',
    updatedAt: '2026-06-05T00:00:00.000Z',
  });
  const emitted = [];
  const originalLog = console.log;

  await withMockedOrderMethod('findById', async (id) => {
    assert.equal(id, 'order-1');
    return updatedOrder;
  }, async () => {
    console.log = () => {};

    try {
      const res = await callController(adminController.updateAdminOrderStatus, {
        params: { id: 'order-1' },
        body: { status: 'shipped' },
        app: {
          get(key) {
            assert.equal(key, 'io');

            return {
              to(room) {
                assert.equal(room, 'user:user-1');

                return {
                  emit(eventName, payload) {
                    emitted.push({ eventName, payload, room });
                  },
                };
              },
              emit(eventName, payload) {
                emitted.push({ eventName, payload });
              },
            };
          },
        },
      });

      assert.equal(updatedOrder.status, 'shipped');
      assert.equal(updatedOrder.cancelledAt, null);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.payload, {
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder,
      });
    } finally {
      console.log = originalLog;
    }
  });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].eventName, 'user:order-updated');
  assert.equal(emitted[0].payload.orderCode, 'ORD001');
  assert.equal(emitted[0].payload.status, 'shipped');
  assert.equal(emitted[0].payload.order, updatedOrder);
});

test('updateAdminOrderStatus updates payment status and returns the order', async () => {
  const updatedOrder = createOrderDoc();

  await withMockedOrderMethod('findById', async (id) => {
    assert.equal(id, 'order-1');
    return updatedOrder;
  }, async () => {
    const res = await callController(adminController.updateAdminOrderStatus, {
      params: { id: 'order-1' },
      body: { paymentStatus: 'paid' },
    });

    assert.equal(updatedOrder.paymentStatus, 'paid');
    assert.ok(updatedOrder.paidAt instanceof Date);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder,
    });
  });
});

test('updateAdminOrderStatus restores stock when admin cancels an active order', async () => {
  const updatedOrder = createOrderDoc({ status: 'confirmed' });
  const book = createBookDoc();

  await withMockedBookMethod('find', async () => [book], async () => withMockedOrderMethod('findById', async () => updatedOrder, async () => {
    const res = await callController(adminController.updateAdminOrderStatus, {
      params: { id: 'order-1' },
      body: { status: 'cancelled' },
    });

    assert.equal(updatedOrder.status, 'cancelled');
    assert.equal(updatedOrder.stockRestored, true);
    assert.equal(book.stock, 10);
    assert.equal(book.sold, 1);
    assert.equal(res.statusCode, 200);
  }));
});

test('updateAdminOrderStatus returns 404 when order is not found', async () => {
  await withMockedOrderMethod('findById', async () => null, async () => {
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

test('getAdminReviews returns newest populated reviews with default limit', async () => {
  const reviews = [
    {
      _id: 'review-1',
      user: { name: 'Nguyen Van A', email: 'a@example.com' },
      book: { title: 'Readora Book', coverImage: 'cover.jpg' },
      order: { orderCode: 'ORD001' },
      rating: 5,
      comment: 'Hay',
    },
  ];

  await withMockedReviewMethod('find', (query) => {
    assert.deepEqual(query, {});

    return {
      populate(path, fields) {
        this.populates = [...(this.populates || []), [path, fields]];
        return this;
      },
      sort(sortQuery) {
        assert.deepEqual(sortQuery, { createdAt: -1 });
        return this;
      },
      limit(limit) {
        assert.equal(limit, 50);
        assert.deepEqual(this.populates, [
          ['user', 'name email'],
          ['book', 'title coverImage'],
          ['order', 'orderCode'],
        ]);
        return Promise.resolve(reviews);
      },
    };
  }, async () => {
    const res = await callController(adminController.getAdminReviews, { query: {} });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Reviews fetched successfully',
      data: reviews,
    });
  });
});

test('buildUserOrderUpdatedPayload returns realtime order update shape', () => {
  const order = createOrderDoc({
    _id: 'order-1',
    orderCode: 'ORD001',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'cod',
    updatedAt: '2026-06-05T00:00:00.000Z',
  });

  assert.deepEqual(adminController.buildUserOrderUpdatedPayload(order), {
    type: 'order-status',
    title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 c\u1eadp nh\u1eadt',
    message: '\u0110\u01a1n #ORD001 \u0111\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i: \u0110\u00e3 giao',
    order,
    orderId: 'order-1',
    orderCode: 'ORD001',
    status: 'delivered',
    paymentStatus: 'paid',
    updatedAt: '2026-06-05T00:00:00.000Z',
  });
});

test('getAdminStats returns dashboard analytics summary', async () => {
  const recentOrders = [createOrderDoc({ _id: 'order-2', orderCode: 'ORD002', totalAmount: 120000 })];
  const lowStockBooks = [createBookDoc({ title: 'SÃ¡ch gáº§n háº¿t', author: 'Readora', stock: 4 })];
  const soldBooks = [createBookDoc({ title: 'SÃ¡ch bÃ¡n cháº¡y', author: 'Readora', sold: 9, stock: 12 })];
  const originalOrderMethods = {
    countDocuments: Order.countDocuments,
    aggregate: Order.aggregate,
    find: Order.find,
  };
  const originalBookMethods = {
    countDocuments: Book.countDocuments,
    find: Book.find,
  };
  const aggregateResults = [
    [{ total: 500000 }],
    [{ total: 300000 }],
    [{ total: 90000 }],
    [{ _id: '507f1f77bcf86cd799439011', title: 'SÃ¡ch bÃ¡n cháº¡y', totalSold: 11 }],
    [{ _id: '2026-06-06', revenue: 500000, orders: 2 }],
  ];

  Order.countDocuments = async (query) => {
    assert.deepEqual(query['$or'], expectedProcessableOrderQuery['$or']);
    if (Object.keys(query).length === 1) return 8;
    if (query.status === 'pending') return 2;
    if (query.status === 'delivered') return 4;
    if (query.status === 'cancelled') return 1;
    if (query.createdAt) return 3;
    return 0;
  };
  Order.aggregate = async (pipeline) => {
    assert.deepEqual(pipeline[0]['$match']['$or'], expectedProcessableOrderQuery['$or']);
    return aggregateResults.shift();
  };
  Order.find = (query) => {
    assert.deepEqual(query, expectedProcessableOrderQuery);

    return {
    populate(path, fields) {
      assert.equal(path, 'user');
      assert.equal(fields, 'name email');
      return this;
    },
    sort(sortQuery) {
      assert.deepEqual(sortQuery, { createdAt: -1 });
      return this;
    },
    limit(limit) {
      assert.equal(limit, 5);
      return Promise.resolve(recentOrders);
    },
  };
  };
  Book.countDocuments = async (query) => {
    assert.deepEqual(query, {});
    return 12;
  };
  Book.find = (query) => ({
    sort(sortQuery) {
      this.query = query;
      this.sortQuery = sortQuery;
      return this;
    },
    limit(limit) {
      if (this.query.stock) {
        assert.equal(limit, 20);
        assert.deepEqual(this.sortQuery, { stock: 1, title: 1 });
        return Promise.resolve(lowStockBooks);
      }

      assert.equal(limit, 5);
      assert.deepEqual(this.sortQuery, { sold: -1, soldCount: -1 });
      return Promise.resolve(soldBooks);
    },
  });

  try {
    const res = await callController(adminController.getAdminStats, {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.data.totalBooks, 12);
    assert.equal(res.payload.data.totalOrders, 8);
    assert.equal(res.payload.data.pendingOrders, 2);
    assert.equal(res.payload.data.deliveredOrders, 4);
    assert.equal(res.payload.data.cancelledOrders, 1);
    assert.equal(res.payload.data.totalRevenueDelivered, 500000);
    assert.equal(res.payload.data.totalRevenuePaid, 300000);
    assert.equal(res.payload.data.todayOrders, 3);
    assert.equal(res.payload.data.todayRevenue, 90000);
    assert.deepEqual(res.payload.data.recentOrders, recentOrders);
    assert.deepEqual(res.payload.data.lowStockBooks, lowStockBooks);
    assert.equal(res.payload.data.topSellingBooks[0].title, 'SÃ¡ch bÃ¡n cháº¡y');
    assert.equal(res.payload.data.topSellingBooks[0].totalSold, 11);
    assert.equal(res.payload.data.revenueByDay.length, 7);
    assert.equal(res.payload.data.revenueByDay.at(-1).revenue, 500000);
  } finally {
    Object.assign(Order, originalOrderMethods);
    Object.assign(Book, originalBookMethods);
  }
});
