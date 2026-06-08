const Order = require('../models/order.model');
const Book = require('../models/book.model');
const Review = require('../models/review.model');
const { emitStockUpdated, restoreOrderStock } = require('./order.controller');

const allowedOrderStatuses = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];
const allowedPaymentStatuses = ['unpaid', 'paid'];

const processableOrderQuery = {
  $or: [
    { paymentMethod: 'cod' },
    { paymentMethod: 'bank_transfer', paymentStatus: 'paid' },
  ],
};

const paidRevenueOrderQuery = {
  paymentStatus: 'paid',
  status: 'delivered',
};

const orderStatusLabels = {
  pending: '\u0043h\u1edd x\u00e1c nh\u1eadn',
  confirmed: '\u0110\u00e3 x\u00e1c nh\u1eadn',
  shipped: '\u0110ang giao',
  delivered: '\u0110\u00e3 giao',
  cancelled: '\u0110\u00e3 h\u1ee7y',
};

const buildUserOrderUpdatedPayload = (order) => {
  const statusLabel = orderStatusLabels[order.status] || order.status;

  return {
    type: 'order-status',
    title: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 c\u1eadp nh\u1eadt',
    message: `\u0110\u01a1n #${order.orderCode} \u0111\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i: ${statusLabel}`,
    order,
    orderId: order._id,
    orderCode: order.orderCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    updatedAt: order.updatedAt || new Date(),
  };
};

const buildUserOrderStatusUpdatedPayload = (order) => {
  const statusLabel = orderStatusLabels[order.status] || order.status;

  return {
    orderId: order._id,
    orderCode: order.orderCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    message: `\u0110\u01a1n #${order.orderCode} \u0111\u00e3 chuy\u1ec3n sang: ${statusLabel}`,
    updatedAt: order.updatedAt || new Date(),
  };
};

const emitUserOrderUpdated = (req, order) => {
  const io = req.app ? req.app.get('io') : null;

  if (!io) {
    return;
  }

  const payload = buildUserOrderUpdatedPayload(order);
  const statusPayload = buildUserOrderStatusUpdatedPayload(order);
  const userId = order.user?._id || order.user;

  if (userId) {
    io.to(`user:${userId}`).emit('user:order-updated', payload);
    io.to(`user:${userId}`).emit('user:order-status-updated', statusPayload);
  } else {
    io.emit('user:order-updated', payload);
    io.emit('user:order-status-updated', statusPayload);
  }

  console.log('[socket emit] user:order-updated', order.orderCode, order.status);
  console.log('[socket emit] user:order-status-updated', order.orderCode, order.status);
};

const startOfDay = (date) => {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const formatDayKey = (date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const normalizeTopSellingBook = (book) => ({
  _id: book._id,
  title: book.title,
  author: book.author,
  coverImage: book.coverImage || book.image || '',
  stock: Number(book.stock) || 0,
  sold: Number(book.sold ?? book.soldCount ?? 0) || 0,
  soldCount: Number(book.soldCount ?? book.sold ?? 0) || 0,
  totalSold: Number(book.totalSold ?? book.soldCount ?? book.sold ?? 0) || 0,
});

const getAdminStats = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const sevenDaysStart = addDays(todayStart, -6);

    const [
      totalBooks,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      deliveredRevenueResult,
      paidRevenueResult,
      todayOrders,
      todayRevenueResult,
      recentOrders,
      lowStockBooks,
      soldBooks,
      orderTopSellingBooks,
      revenueByDayRows,
    ] = await Promise.all([
      Book.countDocuments({}),
      Order.countDocuments(processableOrderQuery),
      Order.countDocuments({ ...processableOrderQuery, status: 'pending' }),
      Order.countDocuments({ ...processableOrderQuery, status: 'delivered' }),
      Order.countDocuments({ ...processableOrderQuery, status: 'cancelled' }),
      Order.aggregate([{ $match: { ...paidRevenueOrderQuery, status: 'delivered' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $match: paidRevenueOrderQuery }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.countDocuments({ ...processableOrderQuery, createdAt: { $gte: todayStart, $lt: tomorrowStart } }),
      Order.aggregate([{ $match: { ...paidRevenueOrderQuery, createdAt: { $gte: todayStart, $lt: tomorrowStart } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Order.find(processableOrderQuery).populate('user', 'name email').sort({ createdAt: -1 }).limit(5),
      Book.find({ stock: { $lte: 10 } }).sort({ stock: 1, title: 1 }).limit(20),
      Book.find({}).sort({ sold: -1, soldCount: -1 }).limit(5),
      Order.aggregate([
        { $match: processableOrderQuery },
        { $unwind: '$items' },
        { $group: { _id: '$items.book', title: { $first: '$items.title' }, coverImage: { $first: '$items.coverImage' }, totalSold: { $sum: '$items.quantity' }, totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $match: { ...paidRevenueOrderQuery, createdAt: { $gte: sevenDaysStart, $lt: tomorrowStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const orderTopById = new Map(orderTopSellingBooks.map((book) => [String(book._id), book]));
    const topSellingBooks = soldBooks.map((book) => {
      const orderStats = orderTopById.get(String(book._id));
      const bookObject = typeof book.toObject === 'function' ? book.toObject() : book;
      return normalizeTopSellingBook({ ...bookObject, totalSold: orderStats?.totalSold ?? bookObject.sold });
    });

    if (topSellingBooks.length === 0) {
      topSellingBooks.push(...orderTopSellingBooks.map(normalizeTopSellingBook));
    }

    const revenueByDayMap = new Map(revenueByDayRows.map((row) => [row._id, row]));
    const revenueByDay = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(sevenDaysStart, index);
      const day = formatDayKey(date);
      const row = revenueByDayMap.get(day);
      return { day, revenue: Number(row?.revenue || 0), orders: Number(row?.orders || 0) };
    });

    return res.status(200).json({
      success: true,
      message: 'Admin stats fetched successfully',
      data: {
        totalBooks,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        totalRevenueDelivered: Number(deliveredRevenueResult[0]?.total || 0),
        totalRevenuePaid: Number(paidRevenueResult[0]?.total || 0),
        todayOrders,
        todayRevenue: Number(todayRevenueResult[0]?.total || 0),
        recentOrders,
        topSellingBooks: topSellingBooks.slice(0, 5),
        lowStockBooks,
        revenueByDay,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const buildAdminOrderUpdatedPayload = (order) => ({
  type: 'order-update',
  title: 'Đơn hàng đã cập nhật',
  message: `Đơn #${order.orderCode} đã được cập nhật.`,
  order,
  orderId: order._id,
  orderCode: order.orderCode,
  status: order.status,
  paymentStatus: order.paymentStatus,
  updatedAt: order.updatedAt || new Date(),
});

const emitAdminOrderUpdated = (req, order) => {
  const io = req.app ? req.app.get('io') : null;

  if (!io) {
    return;
  }

  io.emit('admin:order-updated', buildAdminOrderUpdatedPayload(order));
};

const getAdminReviews = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const reviews = await Review.find({})
      .populate('user', 'name email')
      .populate('book', 'title coverImage')
      .populate('order', 'orderCode')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: 'Reviews fetched successfully',
      data: reviews,
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find(processableOrderQuery)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
};

const getAdminOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, ...processableOrderQuery }).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Order fetched successfully',
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

const updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { paymentStatus, status } = req.body;

    if (status !== undefined && !allowedOrderStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    if (paymentStatus !== undefined && !allowedPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    if (status === undefined && paymentStatus === undefined) {
      return res.status(400).json({ success: false, message: 'No order update provided' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const previousStatus = order.status;
    let changedBooks = [];

    if (status !== undefined) {
      if (status === 'cancelled' && previousStatus !== 'cancelled' && previousStatus !== 'delivered') {
        changedBooks = await restoreOrderStock(order);
      }

      order.status = status;
      order.cancelledAt = status === 'cancelled' ? Date.now() : null;
    }

    if (paymentStatus !== undefined) {
      order.paymentStatus = paymentStatus;
      order.paidAt = paymentStatus === 'paid' ? new Date() : null;

      if (paymentStatus === 'unpaid') {
        order.paymentProvider = '';
        order.paymentTransactionId = '';
      }
    }

    await order.save();

    if (typeof order.populate === 'function') {
      await order.populate('user', 'name email');
    }

    emitStockUpdated(req, changedBooks);
    emitUserOrderUpdated(req, order);

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  allowedOrderStatuses,
  allowedPaymentStatuses,
  buildUserOrderUpdatedPayload,
  getAdminOrderById,
  getAdminOrders,
  getAdminReviews,
  getAdminStats,
  updateAdminOrderStatus,
};
