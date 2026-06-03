const Review = require('../models/review.model');
const Book = require('../models/book.model');
const Order = require('../models/order.model');

const getBookReviews = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    const reviews = await Review.find({ book: bookId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Reviews fetched successfully',
      data: reviews,
    });
  } catch (error) {
    return next(error);
  }
};

const createBookReview = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    const ratingNum = Number(rating);

    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    const existingReview = await Review.findOne({ user: userId, book: bookId });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Ban da danh gia sach nay roi',
      });
    }

    const deliveredOrder = await Order.findOne({
      user: userId,
      status: 'delivered',
      'items.book': bookId,
    });

    if (!deliveredOrder) {
      return res.status(400).json({
        success: false,
        message: 'Ban co the danh gia sau khi don hang duoc giao thanh cong',
      });
    }

    const review = await Review.create({
      user: userId,
      book: bookId,
      order: deliveredOrder._id,
      rating: ratingNum,
      comment: comment || '',
    });

    const stats = await Review.aggregate([
      { $match: { book: book._id } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);

    if (stats.length > 0) {
      book.rating = Math.round(stats[0].avgRating * 10) / 10;
      book.reviewCount = stats[0].count;
    } else {
      book.rating = ratingNum;
      book.reviewCount = 1;
    }

    await book.save();

    const populatedReview = await Review.findById(review._id).populate('user', 'name avatar');

    return res.status(201).json({
      success: true,
      message: 'Danh gia da duoc gui thanh cong',
      data: populatedReview,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getBookReviews,
  createBookReview,
};
