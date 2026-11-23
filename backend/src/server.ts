import { createApp } from './app';
import { config } from './config/env';
import { pool } from './db/pool';

const app = createApp();
const server = app.listen(config.port, () => console.log(`Book Worm API listening on :${config.port} (${config.env}) - docs at /api/docs`));

const shutdown = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
