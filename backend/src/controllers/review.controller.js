const Review = require("../models/review.model");
const Book = require("../models/book.model");
const Order = require("../models/order.model");
const mongoose = require("mongoose");

const getBookReviews = async (req, res, next) => {
  try {
    const { bookId } = req.params;

    const reviews = await Review.find({ book: bookId })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    return next(error);
  }
};

const createBookReview = async (req, res, next) => {
  try {
    // 1. Chuẩn hóa userId – tuyệt đối không truyền req.user object vào Mongoose
    const userId = req.user?._id || req.user?.id || req.userId;

    // 2. Chuẩn hóa bookId, body fields
    const bookId = req.params.id || req.params.bookId;
    const { rating, comment, orderId } = req.body || {};

    // 3. Validate userId required
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng",
      });
    }

    // 4. Validate rating and orderId required
    if (rating === undefined || rating === null || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Rating and orderId are required",
      });
    }

    if (!bookId || !mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: "ID sách không hợp lệ",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "ID đơn hàng không hợp lệ",
      });
    }

    // 5. Validate rating range 1-5
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // 6. Kiểm tra book tồn tại
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sách",
      });
    }

    // 7. Query order: user=userId, status=delivered, items.book=bookId
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      status: "delivered",
      "items.book": bookId,
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng hợp lệ",
      });
    }

    // 8. Check duplicate review
    const existingReview = await Review.findOne({
      user: userId,
      book: bookId,
      order: orderId,
    });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đánh giá sách này trong đơn hàng này rồi",
      });
    }

    // 9. Create review – chỉ dùng userId (primitive), không dùng req.user
    const review = await Review.create({
      user: userId,
      book: bookId,
      order: orderId,
      rating: ratingNum,
      comment: comment || "",
    });

    // 10. Cập nhật rating trung bình cho sách
    const stats = await Review.aggregate([
      { $match: { book: book._id } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      book.rating = Math.round(stats[0].avgRating * 10) / 10;
      book.reviewCount = stats[0].count;
    } else {
      book.rating = ratingNum;
      book.reviewCount = 1;
    }
    await book.save();

    // 11. Populate user để trả về
    const populatedReview = await Review.findById(review._id).populate(
      "user",
      "name avatar"
    );

    // 12. Socket emit thông báo realtime
    const io = req.app ? req.app.get("io") : null;
    if (io) {
      const orderIdStr = typeof orderId === "object" ? String(orderId) : orderId;
      const payload = {
        type: "review",
        message: "Có đánh giá mới",
        bookTitle: book.title,
        userName: populatedReview?.user?.name || "Người dùng",
        rating: ratingNum,
        comment: populatedReview?.comment || "",
        createdAt: new Date(
          populatedReview?.createdAt || review.createdAt || Date.now()
        ).toISOString(),
        orderId: orderIdStr,
      };
      console.log("[review] emit admin:new-review", payload);
      io.emit("admin:new-review", payload);
    }

    return res.status(201).json({
      success: true,
      message: "Đánh giá đã được gửi thành công",
      data: populatedReview,
    });
  } catch (error) {
    console.error("[review] create error", error);
    return res.status(500).json({
      success: false,
      message: "Không gửi được đánh giá",
    });
  }
};

module.exports = {
  getBookReviews,
  createBookReview,
};


