const express = require('express');

const { handleSepayWebhook } = require('../controllers/payment.controller');

const router = express.Router();

router.post('/sepay/webhook', handleSepayWebhook);

module.exports = router;
