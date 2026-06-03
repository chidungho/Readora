const express = require('express');

const {
  getBookReviews,
  createBookReview,
} = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router({ mergeParams: true });

router.get('/', getBookReviews);
router.post('/', authMiddleware, createBookReview);

module.exports = router;
