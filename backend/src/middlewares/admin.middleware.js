const authMiddleware = require('./auth.middleware');

const adminMiddleware = async (req, res, next) => {
  await authMiddleware(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access is required',
      });
    }

    return next();
  });
};

module.exports = adminMiddleware;
