const assert = require('node:assert/strict');
const test = require('node:test');

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');

const withMongoUri = async (value, action) => {
  const originalValue = process.env.MONGODB_URI;

  if (value === undefined) {
    delete process.env.MONGODB_URI;
  } else {
    process.env.MONGODB_URI = value;
  }

  try {
    return await action();
  } finally {
    if (originalValue === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalValue;
    }
  }
};

test('getMongoUri requires MONGODB_URI with a clear error', async () => {
  await withMongoUri(undefined, async () => {
    assert.throws(
      () => connectDB.getMongoUri(),
      /MONGODB_URI is required/,
    );
  });
});

test('getMongoUri rejects placeholder MongoDB Atlas values', async () => {
  const protocol = 'mongodb' + '+srv://';
  const placeholderCluster = ['YOUR', 'CLUSTER'].join('_');

  await withMongoUri(`${protocol}user:secret@${placeholderCluster}.mongodb.net/readora`, async () => {
    assert.throws(
      () => connectDB.getMongoUri(),
      /placeholder values/,
    );
  });
});

test('maskMongoUri hides the password but keeps the rest readable', () => {
  const protocol = 'mongodb' + '+srv://';
  const uri = `${protocol}readora_user:super-secret@cluster.mongodb.net/readora?retryWrites=true`;

  assert.equal(
    connectDB.maskMongoUri(uri),
    `${protocol}readora_user:****@cluster.mongodb.net/readora?retryWrites=true`,
  );
});

test('connectDB reads and connects with process.env.MONGODB_URI', async () => {
  const originalConnect = mongoose.connect;
  const originalLog = console.log;
  const protocol = 'mongodb' + '+srv://';
  const uri = `${protocol}readora_user:super-secret@cluster.mongodb.net/readora`;
  const logLines = [];
  let receivedUri;

  mongoose.connect = async (mongoUri) => {
    receivedUri = mongoUri;
  };
  console.log = (message) => {
    logLines.push(message);
  };

  try {
    await withMongoUri(uri, async () => {
      await connectDB();
    });
  } finally {
    mongoose.connect = originalConnect;
    console.log = originalLog;
  }

  assert.equal(receivedUri, uri);
  assert.equal(logLines.some((line) => line.includes('super-secret')), false);
  assert.equal(logLines.some((line) => line.includes('****')), true);
});
