const fs = require('fs');
const path = require('path');

const multer = require('multer');

const uploadRoot = path.join(__dirname, '../../uploads/book-covers');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadRoot);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `book-cover-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    callback(null, filename);
  },
});

const bookCoverUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'cover'));
    }

    return callback(null, true);
  },
}).single('cover');

const uploadBookCover = (req, res) => {
  bookCoverUpload(req, res, (error) => {
    if (error) {
      const isSizeError = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';

      return res.status(400).json({
        success: false,
        message: isSizeError ? 'Ảnh bìa không được vượt quá 5MB.' : 'Chỉ nhận ảnh JPEG, PNG hoặc WEBP.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Chưa chọn ảnh bìa.',
      });
    }

    return res.status(200).json({
      success: true,
      url: `/uploads/book-covers/${req.file.filename}`,
    });
  });
};

module.exports = {
  uploadBookCover,
};
