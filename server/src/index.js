import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';

try {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const server = app.listen(env.PORT, () => console.log(`API listening on port ${env.PORT}`));
  const shutdown = async signal => {
    console.log(`${signal} received; shutting down`);
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('Could not start API:', error.message);
  process.exit(1);
}
