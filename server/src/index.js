import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';

try {
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 1,
    socketTimeoutMS: 45000,
  });
  const server = app.listen(env.PORT, () => console.log('API listening on port ' + env.PORT));
  server.requestTimeout = 30000;
  server.headersTimeout = 35000;
  server.keepAliveTimeout = 5000;

  let shuttingDown = false;
  const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(signal + ' received; shutting down gracefully');
    const forceExit = setTimeout(() => {
      console.error('Graceful shutdown timed out.');
      process.exit(1);
    }, 10000);
    forceExit.unref();
    server.close(async error => {
      try { await mongoose.disconnect(); }
      catch (disconnectError) { console.error('Database disconnect failed:', disconnectError.message); }
      clearTimeout(forceExit);
      process.exit(error ? 1 : 0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('Could not start API:', error.message);
  process.exit(1);
}
