const Order = require('../models/order.model');

const orderCodePattern = /READORA[-\s]?([A-Z0-9]+)/i;
const contentFields = ['content', 'description', 'transaction_content', 'transferContent'];
const amountFields = ['transferAmount', 'amount', 'money', 'value'];
const transactionIdFields = ['id', 'reference', 'transactionId', 'transaction_id', 'code'];

const firstPresentValue = (payload, fields) => {
  for (const field of fields) {
    if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
      return payload[field];
    }
  }

  return undefined;
};

const parseAmount = (value) => {
  if (typeof value === 'number') {
    return value;
  }

  const normalizedValue = String(value || '').replace(/[^\d.-]/g, '');
  const amount = Number(normalizedValue);

  return Number.isFinite(amount) ? amount : NaN;
};

const extractSepayPayment = (payload = {}) => {
  const content = String(firstPresentValue(payload, contentFields) || '').trim();
  const amount = parseAmount(firstPresentValue(payload, amountFields));
  const matchedOrderCode = content.match(orderCodePattern)?.[1]?.toUpperCase();
  const transactionId = firstPresentValue(payload, transactionIdFields);

  return {
    amount,
    content,
    orderCode: matchedOrderCode,
    transactionId: transactionId === undefined ? '' : String(transactionId),
  };
};

const handleSepayWebhook = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[sepay] webhook payload', req.body);
    }

    const { amount, content, orderCode, transactionId } = extractSepayPayment(req.body);

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        message: 'Order code not found in transfer content',
      });
    }

    const order = await Order.findOne({ orderCode });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (!Number.isFinite(amount) || amount < order.totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Transfer amount is less than order total',
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        message: 'Order already paid',
      });
    }

    order.paymentStatus = 'paid';
    order.paymentProvider = 'sepay';
    order.paymentTransactionId = transactionId;
    order.paidAt = new Date();
    order.paymentNote = content;

    await order.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('admin:payment-paid', {
        orderId: order._id,
        orderCode: order.orderCode,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  extractSepayPayment,
  handleSepayWebhook,
};
