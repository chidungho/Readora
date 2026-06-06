const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user.model');
const googleAuthService = require('../services/googleAuth.service');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  return process.env.JWT_SECRET;
};

const createToken = (userId) =>
  jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const removePassword = (user) => {
  const safeUser = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete safeUser.password;

  return safeUser;
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });
    const token = createToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Register successfully',
      data: {
        user: removePassword(user),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = createToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successfully',
      data: {
        user: removePassword(user),
        token,
      },
    });
  } catch (error) {
    return next(error);
  }
};


const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required',
      });
    }

    const googleUser = await googleAuthService.verifyGoogleIdToken(idToken);
    const normalizedEmail = googleUser.email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const randomPassword = await bcrypt.hash(`google:${normalizedEmail}:${Date.now()}`, 10);

      user = await User.create({
        name: googleUser.name.trim() || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        password: randomPassword,
        avatar: googleUser.avatar,
      });
    }

    const token = createToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successfully',
      data: {
        user: removePassword(user),
        token,
      },
    });
  } catch (error) {
    if (
      error.message === 'GOOGLE_CLIENT_ID is required' ||
      error.message === 'Google account email is not verified'
    ) {
      return res.status(401).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
};

const getProfile = async (req, res) => res.status(200).json({
  success: true,
  message: 'Profile fetched successfully',
  data: {
    user: req.user,
  },
});

module.exports = {
  register,
  login,
  googleLogin,
  getProfile,
};
