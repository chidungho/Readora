const Book = require('../models/book.model');
const Category = require('../models/category.model');

const normalizeCategories = (input) => {
  const values = Array.isArray(input) ? input : [input];
  const seen = new Set();
  const categories = [];

  values
    .filter((value) => value !== undefined && value !== null)
    .flatMap((value) => String(value).split(','))
    .flatMap((value) => value.split(/\s+-\s+/))
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((category) => {
      const key = category.toLocaleLowerCase('vi-VN');

      if (!seen.has(key)) {
        seen.add(key);
        categories.push(category);
      }
    });

  return categories;
};

const createCategorySlug = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildCategoryExactFilter = (name) => {
  const exactName = { $regex: '^' + escapeRegex(name) + '$', $options: 'i' };

  return {
    $or: [
      { category: exactName },
      { categories: exactName },
    ],
  };
};

const upsertCategories = async (categoryNames = []) => {
  const categories = normalizeCategories(categoryNames);

  await Promise.all(categories.map((name) => {
    const slug = createCategorySlug(name);

    if (!slug) {
      return Promise.resolve();
    }

    return Category.updateOne(
      { slug },
      {
        $setOnInsert: {
          name,
          slug,
          description: '',
          icon: '📚',
        },
      },
      { upsert: true },
    );
  }));
};

const getBookCategoryNames = (book = {}) => {
  const categories = normalizeCategories(book.categories);

  if (categories.length > 0) {
    return categories;
  }

  return normalizeCategories(book.category);
};

const syncCategoriesFromBooks = async () => {
  const books = await Book.find({}, { category: 1, categories: 1 });
  const names = [];

  for (const book of books) {
    names.push(...getBookCategoryNames(book));
  }

  await upsertCategories(names);
};

module.exports = {
  buildCategoryExactFilter,
  createCategorySlug,
  getBookCategoryNames,
  normalizeCategories,
  syncCategoriesFromBooks,
  upsertCategories,
};
