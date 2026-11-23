module.exports = async () => {
  const fs = require('fs');
  try { await globalThis.__PG__?.stop(); } catch {}
  try { fs.rmSync(globalThis.__PG_DIR__, { recursive: true, force: true }); } catch {}
};
