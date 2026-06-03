const Order = require('../models/order.model');

const allowedOrderStatuses = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];
const allowedPaymentStatuses = ['unpaid', 'paid'];

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

const updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { paymentStatus, status } = req.body;

    if (status !== undefined && !allowedOrderStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status',
      });
    }

    if (paymentStatus !== undefined && !allowedPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status',
      });
    }

    if (status === undefined && paymentStatus === undefined) {
      return res.status(400).json({
        success: false,
        message: 'No order update provided',
      });
    }

    const updateData = {};

    if (status !== undefined) {
      updateData.status = status;
      updateData.cancelledAt = status === 'cancelled' ? Date.now() : null;
    }

    if (paymentStatus !== undefined) {
      updateData.paymentStatus = paymentStatus;
      updateData.paidAt = paymentStatus === 'paid' ? new Date() : null;

      if (paymentStatus === 'unpaid') {
        updateData.paymentProvider = '';
        updateData.paymentTransactionId = '';
      }
    }

    const order = await Order.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

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
  getAdminOrders,
  updateAdminOrderStatus,
};
