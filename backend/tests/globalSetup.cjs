// Starts a real embedded PostgreSQL for integration tests (no Docker required).
module.exports = async () => {
  const path = require('path');
  const fs = require('fs');
  const os = require('os');
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookworm-pg-'));
  const port = 54329;
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'test', password: 'test', port, persistent: false, onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('bookworm_test');
  globalThis.__PG__ = pg;
  globalThis.__PG_DIR__ = dir;
  process.env.TEST_DATABASE_URL = `postgres://test:test@localhost:${port}/bookworm_test`;
};
