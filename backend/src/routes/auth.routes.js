const express = require('express');

const {
  register,
  login,
  googleLogin,
  getProfile,
} = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/profile', authMiddleware, getProfile);

module.exports = router;
