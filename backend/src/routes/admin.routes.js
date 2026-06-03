const express = require('express');

const {
  createBook,
  deleteBook,
  getBooks,
  updateBook,
} = require('../controllers/book.controller');
const {
  getAdminOrders,
  updateAdminOrderStatus,
} = require('../controllers/admin.controller');
const adminMiddleware = require('../middlewares/admin.middleware');

const router = express.Router();

router.use(adminMiddleware);

router.get('/books', getBooks);
router.post('/books', createBook);
router.put('/books/:id', updateBook);
router.delete('/books/:id', deleteBook);

router.get('/orders', getAdminOrders);
router.patch('/orders/:id/status', updateAdminOrderStatus);

module.exports = router;
