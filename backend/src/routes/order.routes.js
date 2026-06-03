const express = require('express');

const {
  cancelOrder,
  createOrder,
  getMyOrders,
  getOrderById,
} = require('../controllers/order.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', authMiddleware, createOrder);
router.get('/my', authMiddleware, getMyOrders);
router.patch('/:id/cancel', authMiddleware, cancelOrder);
router.get('/:id', authMiddleware, getOrderById);

module.exports = router;
