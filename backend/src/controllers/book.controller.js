const Book = require('../models/book.model');
const {
  buildCategoryExactFilter,
  normalizeCategories,
  upsertCategories,
} = require('../utils/category.utils');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 1000;

const sortOptions = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  popular: { sold: -1, rating: -1, createdAt: -1 },
  rating: { rating: -1, reviewCount: -1, createdAt: -1 },
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const vietnameseSearchChars = {
  a: 'aàáảãạăằắẳẵặâầấẩẫậ',
  e: 'eèéẻẽẹêềếểễệ',
  i: 'iìíỉĩị',
  o: 'oòóỏõọôồốổỗộơờớởỡợ',
  u: 'uùúủũụưừứửữự',
  y: 'yỳýỷỹỵ',
  d: 'dđ',
};

const buildAccentInsensitiveRegex = (value) => {
  const pattern = value
    .trim()
    .split('')
    .map((character) => {
      if (/\s/.test(character)) {
        return '\\s+';
      }

      const lowerCharacter = character.toLocaleLowerCase('vi-VN');
      const searchChars = vietnameseSearchChars[lowerCharacter];

      if (!searchChars) {
        return escapeRegExp(character);
      }

      return `[${searchChars}${searchChars.toLocaleUpperCase('vi-VN')}]`;
    })
    .join('');

  return new RegExp(pattern, 'i');
};

const parsePositiveInteger = (value, fallback) => {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const parseFiniteNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const getNormalizedCategories = (body = {}) => {
  const source = body.categories !== undefined ? body.categories : body.category;

  return normalizeCategories(source);
};

const normalizeBookCategories = (body = {}) => {
  const payload = { ...body };
  const hasCategoryInput = payload.categories !== undefined || payload.category !== undefined;

  if (hasCategoryInput) {
    const categories = getNormalizedCategories(payload);

    payload.categories = categories;
    payload.category = categories[0] || '';
  }

  return payload;
};

const normalizeBookResponse = (book) => {
  const plainBook = typeof book?.toObject === 'function' ? book.toObject() : { ...book };
  const categories = normalizeCategories(plainBook.categories);

  if (categories.length > 0) {
    plainBook.categories = categories;
    plainBook.category = categories[0] || '';
  } else if (typeof plainBook.category === 'string') {
    plainBook.categories = normalizeCategories(plainBook.category);
    plainBook.category = plainBook.categories[0] || plainBook.category || '';
  }

  return plainBook;
};

const buildBooksFilter = (query = {}) => {
  const filter = {};
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const selectedCategories = normalizeCategories(query.category);
  const category = selectedCategories[0] || '';
  const minPrice = parseFiniteNumber(query.minPrice);
  const maxPrice = parseFiniteNumber(query.maxPrice);
  const rating = parseFiniteNumber(query.rating);

  if (search) {
    const searchRegex = buildAccentInsensitiveRegex(search);
    filter.$or = [
      { title: searchRegex },
      { author: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { categories: searchRegex },
    ];
  }

  if (category) {
    const categoryFilter = buildCategoryExactFilter(category);

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, categoryFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, categoryFilter);
    }
  }

  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};

    if (minPrice !== null) {
      filter.price.$gte = minPrice;
    }

    if (maxPrice !== null) {
      filter.price.$lte = maxPrice;
    }
  }

  if (rating !== null) {
    filter.rating = { $gte: rating };
  }

  return filter;
};

const getBooks = async (req, res, next) => {
  try {
    const query = req.query || {};
    const page = parsePositiveInteger(query.page, DEFAULT_PAGE);
    const requestedLimit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const skip = (page - 1) * limit;
    const filter = buildBooksFilter(query);
    const sort = sortOptions[query.sort] || sortOptions.newest;
    const [books, total] = await Promise.all([
      Book.find(filter).sort(sort).skip(skip).limit(limit),
      Book.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: 'Books fetched successfully',
      data: books.map(normalizeBookResponse),
      pagination: {
        page,
        limit,
        total,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getBookById = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Book fetched successfully',
      data: normalizeBookResponse(book),
    });
  } catch (error) {
    return next(error);
  }
};

const createBook = async (req, res, next) => {
  try {
    const payload = normalizeBookCategories(req.body);
    await upsertCategories(payload.categories);
    const book = await Book.create(payload);

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: normalizeBookResponse(book),
    });
  } catch (error) {
    next(error);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const payload = normalizeBookCategories(req.body);
    await upsertCategories(payload.categories);
    const book = await Book.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Book updated successfully',
      data: normalizeBookResponse(book),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully',
      data: normalizeBookResponse(book),
    });
  } catch (error) {
    return next(error);
  }
};

const seedBooks = async (req, res, next) => {
  try {
    // Dữ liệu mẫu để test nhanh bằng Postman hoặc trình duyệt.
    const sampleBooks = [
      {
        title: 'Nhà Giả Kim',
        author: 'Paulo Coelho',
        description: 'Hành trình đi tìm kho báu và ý nghĩa của ước mơ.',
        price: 79000,
        originalPrice: 99000,
        image: 'https://placehold.co/400x600?text=Nha+gia+kim',
        category: 'Tiểu thuyết',
        stock: 20,
        rating: 4.8,
        sold: 120,
        reviewCount: 34,
        isFeatured: true,
      },
      {
        title: 'Từ Tốt Đến Vĩ Đại',
        author: 'Jim Collins',
        description: 'Những nguyên tắc giúp doanh nghiệp tăng trưởng bền vững.',
        price: 145000,
        originalPrice: 169000,
        image: 'https://placehold.co/400x600?text=Tu+tot+den+vi+dai',
        category: 'Kinh doanh',
        stock: 15,
        rating: 4.7,
        sold: 86,
        reviewCount: 21,
        isFeatured: true,
      },
      {
        title: 'Khuyến Học',
        author: 'Fukuzawa Yukichi',
        description: 'Cuốn sách truyền cảm hứng về tinh thần học tập và tự lập.',
        price: 68000,
        originalPrice: 85000,
        image: 'https://placehold.co/400x600?text=Khuyen+hoc',
        category: 'Giáo dục',
        stock: 30,
        rating: 4.6,
        sold: 95,
        reviewCount: 18,
      },
      {
        title: 'Dế Mèn Phiêu Lưu Ký',
        author: 'Tô Hoài',
        description: 'Tác phẩm thiếu nhi kinh điển về tình bạn và lòng dũng cảm.',
        price: 55000,
        originalPrice: 70000,
        image: 'https://placehold.co/400x600?text=De+men',
        category: 'Thiếu nhi',
        stock: 40,
        rating: 4.9,
        sold: 150,
        reviewCount: 42,
        isFeatured: true,
      },
      {
        title: 'Lập Trình JavaScript Hiện Đại',
        author: 'Readora Team',
        description: 'Nhập môn JavaScript, Node.js và cách xây dựng API đơn giản.',
        price: 120000,
        originalPrice: 150000,
        image: 'https://placehold.co/400x600?text=JavaScript',
        category: 'Công nghệ',
        stock: 18,
        rating: 4.5,
        sold: 60,
        reviewCount: 12,
      },
      {
        title: 'Sống Lành Mạnh Mỗi Ngày',
        author: 'Readora Health',
        description: 'Những thói quen nhỏ giúp cải thiện sức khỏe và năng lượng.',
        price: 89000,
        originalPrice: 110000,
        image: 'https://placehold.co/400x600?text=Song+lanh+manh',
        category: 'Sức khỏe',
        stock: 22,
        rating: 4.4,
        sold: 48,
        reviewCount: 9,
      },
    ];

    const booksToSeed = sampleBooks.map((book) => ({
      ...book,
      coverImage: book.coverImage || book.image,
    }));

    await Book.deleteMany({});
    const books = await Book.insertMany(booksToSeed);

    res.status(201).json({
      success: true,
      message: 'Books seeded successfully',
      data: books.map(normalizeBookResponse),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  normalizeCategories,
  seedBooks,
};
