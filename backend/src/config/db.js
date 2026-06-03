const mongoose = require('mongoose');
const Review = require('../models/review.model');

const PLACEHOLDER_TOKENS = [
  ['YOUR', 'USERNAME'].join('_'),
  ['YOUR', 'PASSWORD'].join('_'),
  ['YOUR', 'CLUSTER'].join('_'),
];

const maskMongoUri = (mongoUri) => {
  if (!mongoUri) {
    return '<empty>';
  }

  return mongoUri.replace(
    /(mongodb(?:\+srv)?:\/\/[^:\s/@]+:)([^@\s]+)(@)/i,
    '$1****$3',
  );
};

const getMongoUri = () => {
  const mongoUri = process.env.MONGODB_URI?.trim();

  if (!mongoUri) {
    throw new Error(
      'MONGODB_URI is required. Set it in readora/backend/.env or as an environment variable.',
    );
  }

  if (PLACEHOLDER_TOKENS.some((token) => mongoUri.includes(token))) {
    throw new Error(
      'MONGODB_URI still contains placeholder values. Replace it with your real MongoDB connection string.',
    );
  }

  return mongoUri;
};

const connectDB = async () => {
  try {
    const mongoUri = getMongoUri();

    console.log(`process.env.MONGODB_URI: ${maskMongoUri(mongoUri)}`);
    await mongoose.connect(mongoUri);
    await Review.syncIndexes();
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
module.exports.getMongoUri = getMongoUri;
module.exports.maskMongoUri = maskMongoUri;
