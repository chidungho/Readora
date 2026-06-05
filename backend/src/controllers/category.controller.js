const Category = require('../models/category.model');
const Book = require('../models/book.model');
const {
  buildCategoryExactFilter,
  createCategorySlug,
  getBookCategoryNames,
  syncCategoriesFromBooks,
  upsertCategories,
} = require('../utils/category.utils');

const getCategories = async (req, res, next) => {
  try {
    await syncCategoriesFromBooks();

    const [categories, books] = await Promise.all([
      Category.find({}).sort({ name: 1 }),
      Book.find({}, { category: 1, categories: 1 }),
    ]);
    const categoryMap = new Map();

    for (const category of categories) {
      const plainCategory = typeof category?.toObject === 'function' ? category.toObject() : { ...category };
      categoryMap.set(plainCategory.slug, {
        ...plainCategory,
        bookCount: 0,
      });
    }

    for (const book of books) {
      for (const name of getBookCategoryNames(book)) {
        const slug = createCategorySlug(name);

        if (!slug) {
          continue;
        }

        if (!categoryMap.has(slug)) {
          categoryMap.set(slug, {
            name,
            slug,
            description: '',
            icon: '📚',
            bookCount: 0,
          });
        }

        categoryMap.get(slug).bookCount += 1;
      }
    }

    const syncedCategories = Array.from(categoryMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'vi-VN'),
    );

    await Promise.all(syncedCategories.map((category) =>
      Category.updateOne(
        { slug: category.slug },
        {
          $set: { bookCount: category.bookCount },
          $setOnInsert: {
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            icon: category.icon || '📚',
          },
        },
        { upsert: true },
      ),
    ));

    res.status(200).json({
      success: true,
      data: syncedCategories,
    });
  } catch (error) {
    next(error);
  }
};

const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    const bookCount = await Book.countDocuments(buildCategoryExactFilter(category.name));

    return res.status(200).json({
      success: true,
      data: {
        ...(typeof category?.toObject === 'function' ? category.toObject() : category),
        bookCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryBySlug,
  syncCategoriesFromBooks,
  upsertCategories,
};
