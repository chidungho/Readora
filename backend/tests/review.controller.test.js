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
    book: 'book-456',
    order: 'order-789',
    rating: 4,
    comment: 'Sach hay',
  });

  assert.equal(doc.comment, 'Sach hay');
  assert.equal(Review.schema.options.timestamps, true);
});

test('Review model has a unique compound index on user + book', () => {
  const index = Review.schema.indexes().find(
    ([key]) => key.user === 1 && key.book === 1,
  );

  assert.ok(index, 'Compound index on { user: 1, book: 1 } must exist');
  assert.equal(index[1].unique, true);
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
      book: 'book-456',
      rating: 5,
      comment: 'Tuyet voi',
      createdAt: new Date(),
    },
  ];

  const cleanupFind = overrideModelMethod(Review, 'find', (query) => {
    assert.deepEqual(query, { book: 'book-456' });
    return {
      populate() { return this; },
      sort() { return { then(resolve) { resolve(reviews); } }; },
    };
  });

  try {
    const res = await callController(getBookReviews, {
      params: { bookId: 'book-456' },
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
      params: { bookId: 'book-456' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.data, []);
  } finally {
    cleanupFind();
  }
});

test('createBookReview returns 400 when rating is out of range', async () => {
  const invalidRatings = [0, 6, -1, null, undefined, 'abc'];

  for (const invalid of invalidRatings) {
    const res = await callController(createBookReview, {
      params: { bookId: 'book-456' },
      body: { rating: invalid },
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
      params: { bookId: 'nonexistent' },
      body: { rating: 4, comment: 'OK' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.payload.message, 'Book not found');
  } finally {
    cleanupFindById();
  }
});

test('createBookReview returns 400 when user already reviewed the book', async () => {
  const existingReview = { _id: 'rev-1', user: 'user-123', book: 'book-456' };
  const cleanupBook = overrideModelMethod(Book, 'findById', async (id) => {
    if (id === 'book-456') {
      return { _id: 'book-456', title: 'Sach test' };
    }
    return null;
  });
  const cleanupReview = overrideModelMethod(Review, 'findOne', async (query) => {
    if (query.user === 'user-123' && query.book === 'book-456') {
      return existingReview;
    }
    return null;
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: 'book-456' },
      body: { rating: 4, comment: 'Hay' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 400);
    assert.ok(res.payload.message.includes('danh gia'));
  } finally {
    cleanupReview();
    cleanupBook();
  }
});

test('createBookReview returns 400 when user has no delivered order for this book', async () => {
  const cleanupBook = overrideModelMethod(Book, 'findById', async () => ({
    _id: 'book-456',
    title: 'Sach test',
    rating: 0,
    reviewCount: 0,
    save: async function () { return this; },
  }));
  const cleanupReviewFindOne = overrideModelMethod(Review, 'findOne', async () => null);
  const cleanupOrder = overrideModelMethod(Order, 'findOne', async (query) => {
    assert.equal(query.user, 'user-123');
    assert.equal(query.status, 'delivered');
    assert.equal(query['items.book'], 'book-456');
    return null;
  });

  try {
    const res = await callController(createBookReview, {
      params: { bookId: 'book-456' },
      body: { rating: 4, comment: 'Hay' },
      user: { _id: 'user-123' },
    });

    assert.equal(res.statusCode, 400);
    assert.ok(res.payload.message.includes('don hang'));
  } finally {
    cleanupOrder();
    cleanupReviewFindOne();
    cleanupBook();
  }
});

test('createBookReview creates review and updates book stats', async () => {
  const bookDoc = {
    _id: 'book-456',
    title: 'Sach test',
    rating: 0,
    reviewCount: 0,
    save: async function () { return this; },
  };

  const createdReview = {
    _id: 'rev-new',
    user: { _id: 'user-123', name: 'Nguyen Van A' },
    book: 'book-456',
    order: 'order-789',
    rating: 4,
    comment: 'Sach hay',
    createdAt: new Date(),
  };

  const origReviewFindById = Review.findById;

  const cleanups = [
    overrideModelMethod(Book, 'findById', () => ({ then(resolve) { resolve(bookDoc); } })),
    overrideModelMethod(Review, 'findOne', () => ({ then(resolve) { resolve(null); } })),
    overrideModelMethod(Order, 'findOne', () => ({ then(resolve) { resolve({ _id: 'order-789' }); } })),
    overrideModelMethod(Review, 'create', async (data) => createdReview),
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
      params: { bookId: 'book-456' },
      body: { rating: 4, comment: 'Sach hay' },
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
