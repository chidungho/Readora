const express = require('express');

const {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  seedBooks,
} = require('../controllers/book.controller');

const router = express.Router();

router.get('/', getBooks);
router.post('/seed', seedBooks);
router.post('/', createBook);
router.get('/:id', getBookById);
router.put('/:id', updateBook);
router.delete('/:id', deleteBook);

module.exports = router;
