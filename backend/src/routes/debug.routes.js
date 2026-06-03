const express = require('express');

const router = express.Router();

router.get('/socket-test', (req, res) => {
  const io = req.app.get('io');

  if (!io) {
    return res.status(503).json({
      success: false,
      message: 'Socket.IO is not initialized',
    });
  }

  const payload = {
    type: 'review',
    message: 'Debug socket review notification',
    bookTitle: 'Debug Socket Test',
    userName: 'Debug User',
    rating: 5,
    comment: 'Socket test event',
    createdAt: new Date().toISOString(),
  };

  console.log('emit admin:new-review', payload);
  io.emit('admin:new-review', payload);

  return res.status(200).json({
    success: true,
    message: 'Debug socket review notification emitted',
    data: payload,
  });
});

module.exports = router;
