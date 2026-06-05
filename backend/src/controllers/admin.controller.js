const Order = require('../models/order.model');
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

const emitUserOrderUpdated = (req, order) => {
  const io = req.app ? req.app.get('io') : null;

  if (!io) {
    return;
  }

  const payload = buildUserOrderUpdatedPayload(order);
  const userId = order.user?._id || order.user;

  if (userId) {
    io.to(`user:${userId}`).emit('user:order-updated', payload);
  } else {
    io.emit('user:order-updated', payload);
  }

  console.log('[socket emit] user:order-updated', order.orderCode, order.status);
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
    const orders = await Order.find({})
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
    const order = await Order.findById(req.params.id).populate('user', 'name email');

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
  updateAdminOrderStatus,
};
