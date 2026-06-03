const Book = require('../models/book.model');

const getBooks = async (req, res, next) => {
  try {
    const books = await Book.find({});

    res.status(200).json({
      success: true,
      message: 'Books fetched successfully',
      data: books,
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
      data: book,
    });
  } catch (error) {
    return next(error);
  }
};

const createBook = async (req, res, next) => {
  try {
    const book = await Book.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
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
      data: book,
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
      data: book,
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
      data: books,
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
  seedBooks,
};
