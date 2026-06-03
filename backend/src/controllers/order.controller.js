const Order = require('../models/order.model');

const requiredAddressFields = ['fullName', 'phone', 'address', 'city'];
const cancellableStatuses = ['pending', 'confirmed'];
const allowedPaymentMethods = ['cod', 'bank_transfer'];

const isBlank = (value) => !value || !String(value).trim();

const normalizeOrderItem = (item) => {
  const book = item.book || item.id || item._id;
  const price = Number(item.price);
  const quantity = Number(item.quantity);

  if (!book || isBlank(item.title) || !Number.isFinite(price) || price < 0) {
    return null;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return {
    book,
    title: String(item.title).trim(),
    price,
    quantity: Math.floor(quantity),
    coverImage: item.coverImage || '',
  };
};

const normalizeShippingAddress = (shippingAddress = {}) => {
  const address = {};

  for (const field of requiredAddressFields) {
    const value = shippingAddress[field];

    if (isBlank(value)) {
      return null;
    }

    address[field] = String(value).trim();
  }

  return address;
};

const calculateTotalAmount = (items) =>
  items.reduce((total, item) => total + item.price * item.quantity, 0);

const createOrderCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${timestamp}${randomPart}`;
};

const normalizePaymentMethod = (paymentMethod = 'cod') => {
  const normalizedMethod = String(paymentMethod || 'cod').trim();

  return allowedPaymentMethods.includes(normalizedMethod) ? normalizedMethod : null;
};

const createOrder = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items)
      ? req.body.items.map(normalizeOrderItem).filter(Boolean)
      : [];

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must have at least one item',
      });
    }

    const shippingAddress = normalizeShippingAddress(req.body.shippingAddress);

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required',
      });
    }

    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      orderCode: createOrderCode(),
      totalAmount: calculateTotalAmount(items),
      paymentMethod,
      paymentStatus: 'unpaid',
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Orders fetched successfully',
      data: orders,
    });
  } catch (error) {
    return next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
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

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy đơn hàng ở trạng thái hiện tại',
      });
    }

    const cancelReason = req.body?.cancelReason || req.body?.reason;

    order.status = 'cancelled';
    order.cancelledAt = Date.now();

    if (!isBlank(cancelReason)) {
      order.cancelReason = String(cancelReason).trim();
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Đã hủy đơn hàng',
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  allowedPaymentMethods,
  createOrderCode,
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
};
