const path = require('node:path');

require("dotenv").config({
  path: path.resolve(__dirname, '../.env'),
  override: process.env.NODE_ENV !== 'production',
});

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Readora API server is running on port ${PORT}`);
  });
};

startServer();
