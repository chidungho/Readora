const assert = require('node:assert/strict');
const test = require('node:test');

const Category = require('../src/models/category.model');
const categoryController = require('../src/controllers/category.controller');

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

const withMockedCategoryMethod = async (methodName, mockFn, action) => {
  const hadOwnMethod = Object.prototype.hasOwnProperty.call(Category, methodName);
  const originalMethod = Category[methodName];

  Category[methodName] = mockFn;

  try {
    return await action();
  } finally {
    if (hadOwnMethod) {
      Category[methodName] = originalMethod;
    } else {
      delete Category[methodName];
    }
  }
};

test('Category schema uses requested fields, defaults, and collection name', () => {
  const requiredFields = ['name', 'slug'];
  const optionalFields = ['description', 'icon', 'bookCount'];

  for (const field of requiredFields) {
    assert.equal(Category.schema.path(field).isRequired, true);
  }

  for (const field of optionalFields) {
    assert.ok(Category.schema.path(field));
  }

  const doc = new Category({
    name: 'Life Skills',
    slug: 'ky-nang-song',
  });

  assert.equal(doc.bookCount, 0);
  assert.equal(Category.collection.collectionName, 'categories');
  assert.equal(Category.schema.options.timestamps, true);
});

test('Category controller exports all requested handlers', () => {
  const handlers = ['getCategories', 'getCategoryBySlug'];

  for (const handler of handlers) {
    assert.equal(typeof categoryController[handler], 'function');
  }
});

test('getCategories returns a success response with data', async () => {
  const categories = [{ name: 'Life Skills', slug: 'ky-nang-song' }];

  await withMockedCategoryMethod('find', async () => categories, async () => {
    const res = await callController(categoryController.getCategories);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      data: categories,
    });
  });
});

test('getCategoryBySlug returns a success response with one category', async () => {
  const category = { name: 'Life Skills', slug: 'ky-nang-song' };

  await withMockedCategoryMethod('findOne', async (query) => {
    assert.deepEqual(query, { slug: 'ky-nang-song' });
    return category;
  }, async () => {
    const res = await callController(categoryController.getCategoryBySlug, {
      params: { slug: 'ky-nang-song' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, {
      success: true,
      data: category,
    });
  });
});

test('getCategoryBySlug returns 404 when category is not found', async () => {
  await withMockedCategoryMethod('findOne', async () => null, async () => {
    const res = await callController(categoryController.getCategoryBySlug, {
      params: { slug: 'missing-category' },
    });

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.payload, {
      success: false,
      message: 'Category not found',
    });
  });
});
