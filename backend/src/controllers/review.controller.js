const Review = require('../models/review.model');
const Book = require('../models/book.model');
const Order = require('../models/order.model');

const getEntityId = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value._id) {
    return getEntityId(value._id);
  }

  return value.toString();
};

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
    const { rating, comment, orderId } = req.body;
    const userId = req.user._id;

    const ratingNum = Number(rating);

    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required',
      });
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found',
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (getEntityId(order.user) !== getEntityId(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Ban co the danh gia sau khi don hang duoc giao thanh cong',
      });
    }

    const hasBookInOrder = order.items?.some(
      (item) => getEntityId(item.book) === getEntityId(bookId),
    );

    if (!hasBookInOrder) {
      return res.status(400).json({
        success: false,
        message: 'Don hang nay khong co sach can danh gia',
      });
    }

    const existingReview = await Review.findOne({
      user: userId,
      book: bookId,
      order: orderId,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá sách này trong đơn hàng này rồi.',
      });
    }

    const review = await Review.create({
      user: userId,
      book: bookId,
      order: order._id || orderId,
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
    const io = req.app ? req.app.get('io') : null;
    const orderIdString = getEntityId(order._id || orderId);
    const payload = {
      type: 'review',
      message: 'Có đánh giá mới',
      bookTitle: book.title,
      userName: populatedReview?.user?.name || req.user?.name || 'Nguoi dung',
      rating: ratingNum,
      comment: populatedReview?.comment || '',
      createdAt: new Date(populatedReview?.createdAt || review.createdAt || Date.now()).toISOString(),
      orderId: orderIdString,
    };

    if (io) {
      console.log('emit admin:new-review', payload);
      io.emit('admin:new-review', payload);
    }

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
