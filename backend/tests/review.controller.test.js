const assert = require('node:assert/strict');
const test = require('node:test');

const Review = require('../src/models/review.model');
const Book = require('../src/models/book.model');
const Order = require('../src/models/order.model');
const {
  getBookReviews,
  createBookReview,
} = require('../src/controllers/review.controller');

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

const overrideModelMethod = (Model, methodName, mockFn) => {
  const descriptors = Object.getOwnPropertyDescriptors(Model);
  const hadDescriptor = methodName in descriptors;
  const originalDescriptor = hadDescriptor ? descriptors[methodName] : null;
  const hadOwn = Object.prototype.hasOwnProperty.call(Model, methodName);
  const originalValue = hadOwn ? Model[methodName] : undefined;

  Object.defineProperty(Model, methodName, {
    value: mockFn,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  return () => {
    if (hadDescriptor && originalDescriptor) {
      Object.defineProperty(Model, methodName, originalDescriptor);
    } else if (hadOwn) {
      Model[methodName] = originalValue;
    } else {
      delete Model[methodName];
    }
  };
};

test('Review schema uses required fields, defaults, and timestamps', () => {
  assert.equal(Review.schema.path('user').isRequired, true);
  assert.equal(Review.schema.path('user').options.ref, 'User');
  assert.equal(Review.schema.path('book').isRequired, true);
  assert.equal(Review.schema.path('book').options.ref, 'Book');
  assert.equal(Review.schema.path('order').isRequired, true);
  assert.equal(Review.schema.path('order').options.ref, 'Order');
  assert.equal(Review.schema.path('rating').isRequired, true);
  assert.equal(Review.schema.path('rating').options.min, 1);
  assert.equal(Review.schema.path('rating').options.max, 5);
  assert.equal(Review.schema.path('comment').options.trim, true);

  const doc = new Review({
    user: 'user-123',
    book: '507f1f77bcf86cd799439011',
    order: '507f1f77bcf86cd799439012',
    rating: 4,
    comment: 'Sach hay',
  });

  assert.equal(doc.comment, 'Sach hay');
  assert.equal(Review.schema.options.timestamps, true);
});

test('Review model has a unique compound index on user + book + order', () => {
  const indexes = Review.schema.indexes();
  const index = indexes.find(
    ([key]) => key.user === 1 && key.book === 1 && key.order === 1,
  );
  const legacyIndex = indexes.find(
    ([key, options]) =>
      key.user === 1 &&
      key.book === 1 &&
      key.order === undefined &&
      options.unique === true,
  );

  assert.ok(index, 'Compound index on { user: 1, book: 1, order: 1 } must exist');
  assert.equal(index[1].unique, true);
  assert.equal(legacyIndex, undefined);
});

test('Review controller exports all requested handlers', () => {
  assert.equal(typeof getBookReviews, 'function');
  assert.equal(typeof createBookReview, 'function');
});

test('getBookReviews returns a success response with reviews array', async () => {
  const reviews = [
    {
      _id: 'rev-1',
      user: { _id: 'user-1', name: 'User 1' },
      book: '507f1f77bcf86cd799439011',
      rating: 5,
      comment: 'Tuyet voi',
      createdAt: new Date(),
    },
  ];

  const cleanupFind = overrideModelMethod(Review, 'find', (query) => {
    assert.deepEqual(query, { book: '507f1f77bcf86cd799439011' });
    return {
      populate() { return this; },
      sort() { return { then(resolve) { resolve(reviews); } }; },
    };
  });

  try {
    const res = await callController(getBookReviews, {
      params: { bookId: '507f1f77bcf86cd799439011' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Reviews fetched successfully',
      data: reviews,
    });
  } finally {
    cleanupFind();
  }
});

test('getBookReviews returns an empty array when no reviews exist', async () => {
  const cleanupFind = overrideModelMethod(Review, 'find', () => ({
    populate() { return this; },
    sort() { return { then(resolve) { resolve([]); } }; },
  }));

  try {
    const res = await callController(getBookReviews, {
      params: { bookId: '507f1f77bcf86cd799439011' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.data, []);
  } finally {
    cleanupFind();
  }
});

test('createBookReview returns 400 when rating is out of range', async () => {
  const invalidRatings = [0, 6, -1, 'abc'];

  for (const invalid of invalidRatings) {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: invalid, orderId: '507f1f77bcf86cd799439012' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 400, 'Rating ' + invalid + ' should fail');
    assert.equal(res.payload.success, false);
    assert.equal(res.payload.message, 'Rating must be between 1 and 5');
  }
});
test('createBookReview returns 404 when book is not found', async () => {
  const cleanupFindById = overrideModelMethod(Book, 'findById', async () => null);

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439016' },
      body: { rating: 4, comment: 'OK', orderId: '507f1f77bcf86cd799439012' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.payload.message, 'Không tìm thấy sách');
  } finally {
    cleanupFindById();
  }
});

test('createBookReview returns 400 when orderId is missing', async () => {
  const cleanupFindById = overrideModelMethod(Book, 'findById', async () => ({
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach test',
  }));
  const cleanupReviewFindOne = overrideModelMethod(Review, 'findOne', async () => {
    throw new Error('orderId should be validated before duplicate check');
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 4, comment: 'OK' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.success, false);
    assert.equal(res.payload.message, 'Rating and orderId are required');
  } finally {
    cleanupReviewFindOne();
    cleanupFindById();
  }
});
test('createBookReview returns 400 when user already reviewed this book in this order', async () => {
  const existingReview = {
    _id: 'rev-1',
    user: 'user-123',
    book: '507f1f77bcf86cd799439011',
    order: '507f1f77bcf86cd799439012',
  };
  let createCalled = false;
  let appGetCalled = false;
  const cleanupBook = overrideModelMethod(Book, 'findById', async (id) => {
    if (id === '507f1f77bcf86cd799439011') {
      return { _id: '507f1f77bcf86cd799439011', title: 'Sach test' };
    }
    return null;
  });
  const cleanupOrder = overrideModelMethod(Order, 'findOne', async (query) => {
    assert.deepEqual(query, { _id: '507f1f77bcf86cd799439012', user: 'user-123', status: 'delivered', 'items.book': '507f1f77bcf86cd799439011' });
    return {
      _id: '507f1f77bcf86cd799439012',
      user: 'user-123',
      status: 'delivered',
      items: [{ book: '507f1f77bcf86cd799439011' }],
    };
  });
  const cleanupReview = overrideModelMethod(Review, 'findOne', async (query) => {
    assert.deepEqual(query, {
      user: 'user-123',
      book: '507f1f77bcf86cd799439011',
      order: '507f1f77bcf86cd799439012',
    });
    return existingReview;
  });
  const cleanupCreate = overrideModelMethod(Review, 'create', async () => {
    createCalled = true;
    return { _id: 'rev-new' };
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 4, comment: 'Hay', orderId: '507f1f77bcf86cd799439012' },
      user: { _id: 'user-123' },
      app: {
        get() {
          appGetCalled = true;
          return {
            emit() {
              throw new Error('duplicate reviews must not emit');
            },
          };
        },
      },
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.message, 'Bạn đã đánh giá sách này trong đơn hàng này rồi');
    assert.equal(createCalled, false);
    assert.equal(appGetCalled, false);
  } finally {
    cleanupCreate();
    cleanupReview();
    cleanupOrder();
    cleanupBook();
  }
});

test('createBookReview returns 404 when the selected order is not delivered', async () => {
  const cleanupBook = overrideModelMethod(Book, 'findById', async () => ({
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach test',
    rating: 0,
    reviewCount: 0,
    save: async function () { return this; },
  }));
  const cleanupReviewFindOne = overrideModelMethod(Review, 'findOne', async () => {
    throw new Error('duplicate check should not run before order eligibility');
  });
  const cleanupOrder = overrideModelMethod(Order, 'findOne', async (query) => {
    assert.deepEqual(query, { _id: '507f1f77bcf86cd799439013', user: 'user-123', status: 'delivered', 'items.book': '507f1f77bcf86cd799439011' });
    return null;
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 4, comment: 'Hay', orderId: '507f1f77bcf86cd799439013' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.payload.message, 'Không tìm thấy đơn hàng hợp lệ');
  } finally {
    cleanupOrder();
    cleanupReviewFindOne();
    cleanupBook();
  }
});

test('createBookReview returns 404 when the selected order belongs to another user', async () => {
  const cleanupBook = overrideModelMethod(Book, 'findById', async () => ({
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach test',
  }));
  const cleanupReviewFindOne = overrideModelMethod(Review, 'findOne', async () => {
    throw new Error('duplicate check should not run for another user order');
  });
  const cleanupOrder = overrideModelMethod(Order, 'findOne', async (query) => {
    assert.deepEqual(query, { _id: '507f1f77bcf86cd799439014', user: 'user-123', status: 'delivered', 'items.book': '507f1f77bcf86cd799439011' });
    return null;
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 4, comment: 'Hay', orderId: '507f1f77bcf86cd799439014' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.payload.success, false);
  } finally {
    cleanupOrder();
    cleanupReviewFindOne();
    cleanupBook();
  }
});

test('createBookReview creates review and updates book stats', async () => {
  const bookDoc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach test',
    rating: 0,
    reviewCount: 0,
    save: async function () { return this; },
  };

  const createdReview = {
    _id: 'rev-new',
    user: { _id: 'user-123', name: 'Nguyen Van A' },
    book: '507f1f77bcf86cd799439011',
    order: '507f1f77bcf86cd799439012',
    rating: 4,
    comment: 'Sach hay',
    createdAt: new Date(),
  };

  const origReviewFindById = Review.findById;

  const cleanups = [
    overrideModelMethod(Book, 'findById', () => ({ then(resolve) { resolve(bookDoc); } })),
    overrideModelMethod(Order, 'findOne', (query) => ({
      then(resolve) {
        resolve({
          _id: '507f1f77bcf86cd799439012',
          user: 'user-123',
          status: 'delivered',
          items: [{ book: '507f1f77bcf86cd799439011' }],
        });
      },
    })),
    overrideModelMethod(Review, 'findOne', (query) => {
      assert.deepEqual(query, {
        user: 'user-123',
        book: '507f1f77bcf86cd799439011',
        order: '507f1f77bcf86cd799439012',
      });
      return { then(resolve) { resolve(null); } };
    }),
    overrideModelMethod(Review, 'create', async (data) => {
      assert.deepEqual(data, {
        user: 'user-123',
        book: '507f1f77bcf86cd799439011',
        order: '507f1f77bcf86cd799439012',
        rating: 4,
        comment: 'Sach hay',
      });
      return createdReview;
    }),
    overrideModelMethod(Review, 'aggregate', async () => [{ avgRating: 4.5, count: 3 }]),
    // For findById, we bypass the override pattern and set it directly
    () => {
      // Will be called in reverse order - restore to original
      Review.findById = origReviewFindById;
    },
  ];

  // Directly set findById mock - must return Query-like object (not async)
  Review.findById = (id) => ({
    populate() {
      return { then(resolve) { resolve(createdReview); } };
    },
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 4, comment: 'Sach hay', orderId: '507f1f77bcf86cd799439012' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.success, true);
    assert.deepEqual(res.payload.data, createdReview);
    assert.equal(bookDoc.rating, 4.5);
    assert.equal(bookDoc.reviewCount, 3);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});

test('createBookReview allows the same user to review the same book in another delivered order', async () => {
  const bookDoc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach test',
    rating: 4,
    reviewCount: 1,
    save: async function () { return this; },
  };
  const createdReview = {
    _id: 'rev-new-order',
    user: { _id: 'user-123', name: 'Nguyen Van A' },
    book: '507f1f77bcf86cd799439011',
    order: '507f1f77bcf86cd799439015',
    rating: 5,
    comment: 'Mua lan hai van hay',
    createdAt: new Date(),
  };
  const duplicateQueries = [];
  const createPayloads = [];
  const origReviewFindById = Review.findById;

  const cleanups = [
    overrideModelMethod(Book, 'findById', async () => bookDoc),
    overrideModelMethod(Order, 'findOne', async (query) => {
      assert.deepEqual(query, { _id: '507f1f77bcf86cd799439015', user: 'user-123', status: 'delivered', 'items.book': '507f1f77bcf86cd799439011' });
      return {
        _id: '507f1f77bcf86cd799439015',
        user: 'user-123',
        status: 'delivered',
        items: [{ book: '507f1f77bcf86cd799439011' }],
      };
    }),
    overrideModelMethod(Review, 'findOne', async (query) => {
      duplicateQueries.push(query);
      return null;
    }),
    overrideModelMethod(Review, 'create', async (data) => {
      createPayloads.push(data);
      return createdReview;
    }),
    overrideModelMethod(Review, 'aggregate', async () => [{ avgRating: 4.5, count: 2 }]),
    () => {
      Review.findById = origReviewFindById;
    },
  ];

  Review.findById = () => ({
    populate() {
      return { then(resolve) { resolve(createdReview); } };
    },
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 5, comment: 'Mua lan hai van hay', orderId: '507f1f77bcf86cd799439015' },
      user: { _id: 'user-123', name: 'Nguyen Van A' },
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(duplicateQueries, [
      {
        user: 'user-123',
        book: '507f1f77bcf86cd799439011',
        order: '507f1f77bcf86cd799439015',
      },
    ]);
    assert.deepEqual(createPayloads, [
      {
        user: 'user-123',
        book: '507f1f77bcf86cd799439011',
        order: '507f1f77bcf86cd799439015',
        rating: 5,
        comment: 'Mua lan hai van hay',
      },
    ]);
    assert.equal(bookDoc.rating, 4.5);
    assert.equal(bookDoc.reviewCount, 2);
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});

test('createBookReview emits an admin notification when review is created', async () => {
  const createdAt = new Date('2026-06-03T03:00:00.000Z');
  const emittedEvents = [];
  const logCalls = [];
  const originalLog = console.log;
  const bookDoc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach test',
    rating: 0,
    reviewCount: 0,
    save: async function () { return this; },
  };

  const createdReview = {
    _id: 'rev-new',
    user: 'user-123',
    book: '507f1f77bcf86cd799439011',
    order: '507f1f77bcf86cd799439012',
    rating: 5,
    comment: 'Sach rat hay',
    createdAt,
  };

  const populatedReview = {
    ...createdReview,
    user: { _id: 'user-123', name: 'Nguyen Van A' },
  };

  const origReviewFindById = Review.findById;

  const cleanups = [
    overrideModelMethod(Book, 'findById', () => ({ then(resolve) { resolve(bookDoc); } })),
    overrideModelMethod(Review, 'findOne', () => ({ then(resolve) { resolve(null); } })),
    overrideModelMethod(Order, 'findOne', (query) => ({
      then(resolve) {
        resolve({
          _id: '507f1f77bcf86cd799439012',
          user: 'user-123',
          status: 'delivered',
          items: [{ book: '507f1f77bcf86cd799439011' }],
        });
      },
    })),
    overrideModelMethod(Review, 'create', async () => createdReview),
    overrideModelMethod(Review, 'aggregate', async () => [{ avgRating: 5, count: 1 }]),
    () => {
      Review.findById = origReviewFindById;
    },
  ];

  Review.findById = () => ({
    populate() {
      return { then(resolve) { resolve(populatedReview); } };
    },
  });

  try {
    console.log = (...args) => {
      logCalls.push(args);
    };

    const res = await callController(createBookReview, {
      params: { bookId: '507f1f77bcf86cd799439011' },
      body: { rating: 5, comment: 'Sach rat hay', orderId: '507f1f77bcf86cd799439012' },
      user: { _id: 'user-123', name: 'Nguyen Van A' },
      app: {
        get(key) {
          assert.equal(key, 'io');
          return {
            emit(eventName, payload) {
              emittedEvents.push({ eventName, payload });
            },
          };
        },
      },
    });

    const expectedPayload = {
      type: 'review',
      message: 'Có đánh giá mới',
      bookTitle: 'Sach test',
      userName: 'Nguyen Van A',
      rating: 5,
      comment: 'Sach rat hay',
      createdAt: createdAt.toISOString(),
      orderId: '507f1f77bcf86cd799439012',
    };

    assert.equal(res.statusCode, 201);
    assert.deepEqual(emittedEvents, [
      {
        eventName: 'admin:new-review',
        payload: expectedPayload,
      },
    ]);
    assert.deepEqual(logCalls, [['[review] emit admin:new-review', expectedPayload]]);
    console.log = originalLog;
  } finally {
    console.log = originalLog;
    cleanups.reverse().forEach((cleanup) => cleanup());
  }
});

