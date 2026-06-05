const assert = require('node:assert/strict');
const test = require('node:test');

const Book = require('../src/models/book.model');
const bookController = require('../src/controllers/book.controller');

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

const withMockedBookMethods = async (methodMocks, action) => {
  const originals = new Map();

  for (const [methodName, mockFn] of Object.entries(methodMocks)) {
    originals.set(methodName, {
      hadOwnMethod: Object.prototype.hasOwnProperty.call(Book, methodName),
      originalMethod: Book[methodName],
    });
    Book[methodName] = mockFn;
  }

  try {
    return await action();
  } finally {
    for (const [methodName, original] of originals.entries()) {
      if (original.hadOwnMethod) {
        Book[methodName] = original.originalMethod;
      } else {
        delete Book[methodName];
      }
    }
  }
};

const createBookQueryMock = (books, calls = {}) => ({
  sort(sortOptions) {
    calls.sort = sortOptions;
    return this;
  },
  skip(skipCount) {
    calls.skip = skipCount;
    return this;
  },
  limit(limitCount) {
    calls.limit = limitCount;
    return Promise.resolve(books);
  },
});

test('Book schema uses required fields, defaults, and timestamps', () => {
  const requiredFields = ['title', 'author', 'price', 'category'];
  const optionalFields = ['description', 'originalPrice', 'image', 'coverImage'];

  for (const field of requiredFields) {
    assert.equal(Book.schema.path(field).isRequired, true);
  }

  for (const field of optionalFields) {
    assert.ok(Book.schema.path(field));
  }

  const doc = new Book({
    title: 'Sach mau',
    author: 'Tac gia mau',
    price: 100000,
    category: 'Giao duc',
  });

  assert.deepEqual(doc.categories, []);
  assert.equal(doc.stock, 0);
  assert.equal(doc.rating, 0);
  assert.equal(doc.sold, 0);
  assert.equal(doc.isFeatured, false);
  assert.equal(Book.schema.options.timestamps, true);
});

test('Book controller exports all requested handlers', () => {
  const handlers = [
    'getBooks',
    'getBookById',
    'createBook',
    'updateBook',
    'deleteBook',
    'seedBooks',
  ];

  for (const handler of handlers) {
    assert.equal(typeof bookController[handler], 'function');
  }
});

test('getBooks returns a success response with data', async () => {
  const books = [{ title: 'Nha gia kim' }];
  const calls = {};

  await withMockedBookMethods({
    find: (filter) => {
      calls.filter = filter;
      return createBookQueryMock(books, calls);
    },
    countDocuments: async (filter) => {
      calls.countFilter = filter;
      return 1;
    },
  }, async () => {
    const res = await callController(bookController.getBooks);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Books fetched successfully',
      data: books,
      pagination: {
        page: 1,
        limit: 12,
        total: 1,
        totalPages: 1,
      },
    });
    assert.deepEqual(calls.filter, {});
    assert.deepEqual(calls.countFilter, {});
  });
});

test('getBooks builds search, category, price, rating, sort, and pagination query', async () => {
  const books = [{ title: 'Clean Code' }];
  const calls = {};

  await withMockedBookMethods({
    find: (filter) => {
      calls.filter = filter;
      return createBookQueryMock(books, calls);
    },
    countDocuments: async (filter) => {
      calls.countFilter = filter;
      return 25;
    },
  }, async () => {
    const res = await callController(bookController.getBooks, {
      query: {
        search: 'clean',
        category: 'Cong nghe',
        minPrice: '50000',
        maxPrice: '200000',
        rating: '4.5',
        sort: 'price_asc',
        page: '2',
        limit: '10',
      },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls.filter.$and[1], {
      $or: [{ category: 'Cong nghe' }, { categories: 'Cong nghe' }],
    });
    assert.deepEqual(calls.filter.price, { $gte: 50000, $lte: 200000 });
    assert.deepEqual(calls.filter.rating, { $gte: 4.5 });
    assert.equal(calls.filter.$and[0].$or.length, 5);
    assert.match(calls.filter.$and[0].$or[0].title.source, /^cl/);
    assert.equal(calls.filter.$and[0].$or[0].title.flags, 'i');
    assert.equal(calls.filter.$and[0].$or[1].author.source, calls.filter.$and[0].$or[0].title.source);
    assert.equal(
      calls.filter.$and[0].$or[2].description.source,
      calls.filter.$and[0].$or[0].title.source,
    );
    assert.equal(calls.filter.$and[0].$or[3].category.source, calls.filter.$and[0].$or[0].title.source);
    assert.equal(calls.filter.$and[0].$or[4].categories.source, calls.filter.$and[0].$or[0].title.source);
    assert.deepEqual(calls.countFilter, calls.filter);
    assert.deepEqual(calls.sort, { price: 1, createdAt: -1 });
    assert.equal(calls.skip, 10);
    assert.equal(calls.limit, 10);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Books fetched successfully',
      data: books,
      pagination: {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      },
    });
  });
});

test('getBooks generates categories for legacy comma and dash category responses', async () => {
  const books = [
    {
      title: 'Legacy comma',
      category: 'Tam ly hoc, Ky nang song',
      categories: [],
    },
    {
      title: 'Legacy dash',
      category: 'Tam ly hoc - Ky nang song',
    },
  ];

  await withMockedBookMethods({
    find: () => createBookQueryMock(books),
    countDocuments: async () => books.length,
  }, async () => {
    const res = await callController(bookController.getBooks, { query: {} });

    assert.deepEqual(res.payload.data[0].categories, ['Tam ly hoc', 'Ky nang song']);
    assert.equal(res.payload.data[0].category, 'Tam ly hoc, Ky nang song');
    assert.deepEqual(res.payload.data[1].categories, ['Tam ly hoc', 'Ky nang song']);
  });
});

test('createBook normalizes comma and dash separated categories', async () => {
  const calls = {};

  await withMockedBookMethod('create', async (payload) => {
    calls.payload = payload;
    return payload;
  }, async () => {
    const res = await callController(bookController.createBook, {
      body: {
        title: 'Thay Doi Ti Hon Hieu Qua Bat Ngo',
        author: 'James Clear',
        price: 150000,
        category: 'Tam ly hoc, Ky nang song - Tam ly hoc',
      },
    });

    assert.equal(res.statusCode, 201);
    assert.equal(calls.payload.category, 'Tam ly hoc');
    assert.deepEqual(calls.payload.categories, ['Tam ly hoc', 'Ky nang song']);
  });
});

test('updateBook normalizes provided categories arrays', async () => {
  const calls = {};

  await withMockedBookMethod('findByIdAndUpdate', async (id, payload) => {
    calls.id = id;
    calls.payload = payload;
    return payload;
  }, async () => {
    const res = await callController(bookController.updateBook, {
      params: { id: 'book-1' },
      body: {
        category: 'Ignored primary',
        categories: ['Tam ly hoc', ' Ky nang song ', 'Tam ly hoc', ''],
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(calls.id, 'book-1');
    assert.equal(calls.payload.category, 'Tam ly hoc');
    assert.deepEqual(calls.payload.categories, ['Tam ly hoc', 'Ky nang song']);
  });
});

test('getBooks supports popular, rating, and price descending sort aliases', async () => {
  const expectedSorts = [
    ['popular', { sold: -1, rating: -1, createdAt: -1 }],
    ['rating', { rating: -1, reviewCount: -1, createdAt: -1 }],
    ['price_desc', { price: -1, createdAt: -1 }],
  ];

  for (const [sort, expectedSort] of expectedSorts) {
    const calls = {};

    await withMockedBookMethods({
      find: () => createBookQueryMock([], calls),
      countDocuments: async () => 0,
    }, async () => {
      await callController(bookController.getBooks, {
        query: { sort },
      });

      assert.deepEqual(calls.sort, expectedSort);
    });
  }
});

test('getBookById returns a success response with one book', async () => {
  const book = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Sach chi tiet',
  };

  await withMockedBookMethod('findById', async (id) => {
    assert.equal(id, book._id);
    return book;
  }, async () => {
    const res = await callController(bookController.getBookById, {
      params: { id: book._id },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Book fetched successfully',
      data: book,
    });
  });
});

test('getBookById returns 404 when book is not found', async () => {
  await withMockedBookMethod('findById', async () => null, async () => {
    const res = await callController(bookController.getBookById, {
      params: { id: '507f1f77bcf86cd799439099' },
    });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Book not found',
    });
  });
});

test('createBook returns a 201 success response', async () => {
  const createdBook = { title: 'Sach moi' };

  await withMockedBookMethod('create', async () => createdBook, async () => {
    const res = await callController(bookController.createBook, {
      body: createdBook,
    });

    assert.equal(res.statusCode, 201);
    assert.deepEqual(res.payload, {
      success: true,
      message: 'Book created successfully',
      data: createdBook,
    });
  });
});

test('seedBooks clears old books and inserts six Vietnamese samples', async () => {
  let deleteWasCalled = false;
  let insertedBooks = [];

  await withMockedBookMethod('deleteMany', async () => {
    deleteWasCalled = true;
  }, async () => {
    await withMockedBookMethod('insertMany', async (books) => {
      insertedBooks = books;
      return books;
    }, async () => {
      const res = await callController(bookController.seedBooks);

      assert.equal(deleteWasCalled, true);
      assert.equal(insertedBooks.length, 6);
      assert.deepEqual(
        insertedBooks.map((book) => book.category),
        ['Tiểu thuyết', 'Kinh doanh', 'Giáo dục', 'Thiếu nhi', 'Công nghệ', 'Sức khỏe'],
      );
      assert.equal(res.statusCode, 201);
      assert.deepEqual(res.payload, {
        success: true,
        message: 'Books seeded successfully',
        data: insertedBooks.map((book) => ({
          ...book,
          categories: [book.category],
        })),
      });
    });
  });
});
