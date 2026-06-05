const express = require('express');

const {
  createBook,
  deleteBook,
  getBooks,
  updateBook,
} = require('../controllers/book.controller');
const {
  getAdminOrderById,
  getAdminOrders,
  getAdminReviews,
  updateAdminOrderStatus,
} = require('../controllers/admin.controller');
const { uploadBookCover } = require('../controllers/upload.controller');
const adminMiddleware = require('../middlewares/admin.middleware');

const router = express.Router();

router.use(adminMiddleware);

router.get('/books', getBooks);
router.post('/books', createBook);
router.put('/books/:id', updateBook);
router.delete('/books/:id', deleteBook);

router.post('/uploads/book-cover', uploadBookCover);

router.get('/orders', getAdminOrders);
router.get('/orders/:id', getAdminOrderById);
router.patch('/orders/:id/status', updateAdminOrderStatus);

router.get('/reviews', getAdminReviews);

module.exports = router;
