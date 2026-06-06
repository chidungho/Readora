const Order = require('../models/order.model');
const Book = require('../models/book.model');

const requiredAddressFields = ['fullName', 'phone', 'address', 'city'];
const cancellableStatuses = ['pending', 'confirmed'];
const allowedPaymentMethods = ['cod', 'bank_transfer'];

const isBlank = (value) => !value || !String(value).trim();
const toBookId = (book) => String(book?._id || book?.id || book || '');

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

const calculateTotalAmount = (items) => items.reduce((total, item) => total + item.price * item.quantity, 0);

const createOrderCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return timestamp + randomPart;
};

const normalizePaymentMethod = (paymentMethod = 'cod') => {
  const normalizedMethod = String(paymentMethod || 'cod').trim();

  return allowedPaymentMethods.includes(normalizedMethod) ? normalizedMethod : null;
};

const buildStockPayload = (books) => books.map((book) => ({
  bookId: toBookId(book),
  stock: Number(book.stock) || 0,
  sold: Number(book.sold) || 0,
}));

const emitStockUpdated = (req, books) => {
  const io = req.app ? req.app.get('io') : null;

  if (io && books.length > 0) {
    io.emit('books:stock-updated', buildStockPayload(books));
  }
};

const formatOrderTotal = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
}).format(Number(value) || 0);

const buildAdminOrderObject = (order, req) => ({
  _id: order._id,
  orderCode: order.orderCode,
  user: order.user && typeof order.user === 'object'
    ? {
        name: order.user.name || order.shippingAddress?.fullName || req.user?.name || 'Khách hàng',
        email: order.user.email || req.user?.email || '',
      }
    : {
        name: order.shippingAddress?.fullName || req.user?.name || 'Khách hàng',
        email: req.user?.email || '',
      },
  items: order.items,
  shippingAddress: order.shippingAddress,
  totalAmount: order.totalAmount,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  status: order.status,
  createdAt: order.createdAt,
});

const buildAdminOrderPayload = (order, req) => {
  const fullOrderObject = buildAdminOrderObject(order, req);
  const customerName = fullOrderObject.user?.name || order.shippingAddress?.fullName || 'Khách hàng';
  const itemCount = Array.isArray(order.items)
    ? order.items.reduce((total, item) => total + (Number(item.quantity) || 0), 0)
    : 0;
  const createdAt = new Date(order.createdAt || Date.now()).toISOString();

  return {
    type: 'order',
    title: 'Có đơn hàng mới',
    message: `${customerName} vừa đặt đơn #${order.orderCode}`,
    detail: `${itemCount} sản phẩm · ${formatOrderTotal(order.totalAmount)}`,
    order: fullOrderObject,
    orderCode: order.orderCode,
    createdAt,
  };
};

const emitNewOrder = (req, order) => {
  const io = req.app ? req.app.get('io') : null;

  if (!io) {
    return;
  }

  const payload = buildAdminOrderPayload(order, req);
  io.emit('admin:new-order', payload);

  if (process.env.NODE_ENV !== 'production') {
    console.log('[socket emit] admin:new-order', payload.orderCode || payload.order?.orderCode);
  }
};

const validateOrderStock = async (items) => {
  const bookIds = [...new Set(items.map((item) => toBookId(item.book)))];
  const books = await Book.find({ _id: { $in: bookIds } });
  const booksById = new Map(books.map((book) => [toBookId(book), book]));

  for (const item of items) {
    const book = booksById.get(toBookId(item.book));

    if (!book) {
      return { error: 'Sản phẩm ' + item.title + ' không tồn tại', books: [] };
    }

    const stock = Number(book.stock) || 0;

    if (stock < item.quantity) {
      return { error: 'Sản phẩm ' + (book.title || item.title) + ' chỉ còn ' + stock + ' cuốn', books: [] };
    }
  }

  return { books };
};

const deductOrderStock = async (items, books) => {
  const booksById = new Map(books.map((book) => [toBookId(book), book]));
  const changedBooks = [];

  for (const item of items) {
    const book = booksById.get(toBookId(item.book));
    book.stock = (Number(book.stock) || 0) - item.quantity;
    book.sold = (Number(book.sold) || 0) + item.quantity;
    await book.save();
    changedBooks.push(book);
  }

  return changedBooks;
};

const restoreOrderStock = async (order) => {
  if (!order?.stockDeducted || order.stockRestored || order.status === 'delivered') {
    return [];
  }

  const bookIds = order.items.map((item) => toBookId(item.book));
  const books = await Book.find({ _id: { $in: bookIds } });
  const booksById = new Map(books.map((book) => [toBookId(book), book]));
  const changedBooks = [];

  for (const item of order.items) {
    const book = booksById.get(toBookId(item.book));

    if (!book) {
      continue;
    }

    book.stock = (Number(book.stock) || 0) + item.quantity;
    book.sold = Math.max(0, (Number(book.sold) || 0) - item.quantity);
    await book.save();
    changedBooks.push(book);
  }

  order.stockRestored = true;

  return changedBooks;
};

const createOrder = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items.map(normalizeOrderItem).filter(Boolean) : [];

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have at least one item' });
    }

    const shippingAddress = normalizeShippingAddress(req.body.shippingAddress);

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);

    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    const stockValidation = await validateOrderStock(items);

    if (stockValidation.error) {
      return res.status(400).json({ success: false, message: stockValidation.error });
    }

    const changedBooks = await deductOrderStock(items, stockValidation.books);

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      orderCode: createOrderCode(),
      totalAmount: calculateTotalAmount(items),
      paymentMethod,
      paymentStatus: 'unpaid',
      stockDeducted: true,
      stockRestored: false,
    });

    if (typeof order.populate === 'function') {
      await order.populate('user', 'name email');
    }

    if (paymentMethod === 'cod') {
      emitNewOrder(req, order);
    }

    emitStockUpdated(req, changedBooks);

    return res.status(201).json({ success: true, message: 'Order created successfully', data: order });
  } catch (error) {
    return next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, message: 'Orders fetched successfully', data: orders });
  } catch (error) {
    return next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, message: 'Order fetched successfully', data: order });
  } catch (error) {
    return next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Không thể hủy đơn hàng ở trạng thái hiện tại' });
    }

    const changedBooks = await restoreOrderStock(order);
    const cancelReason = req.body?.cancelReason || req.body?.reason;

    order.status = 'cancelled';
    order.cancelledAt = Date.now();

    if (!isBlank(cancelReason)) {
      order.cancelReason = String(cancelReason).trim();
    }

    await order.save();
    emitStockUpdated(req, changedBooks);

    return res.status(200).json({ success: true, message: 'Đã hủy đơn hàng', data: order });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  allowedPaymentMethods,
  buildStockPayload,
  createOrderCode,
  createOrder,
  emitNewOrder,
  emitStockUpdated,
  getMyOrders,
  getOrderById,
  restoreOrderStock,
  cancelOrder,
};
