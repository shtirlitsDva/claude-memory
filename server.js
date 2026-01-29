const express = require('express');
const path = require('path');

const config = require('./config.json');
const embeddingService = require('./services/embeddings');

const app = express();
app.use(express.json());

let db;
let table;
let startTime = Date.now();

async function initDatabase() {
  const lancedb = await import('@lancedb/lancedb');
  const dbPath = path.join(__dirname, 'data', 'memories.lance');

  console.log(`[db] Connecting to ${dbPath}`);
  db = await lancedb.connect(dbPath);

  try {
    table = await db.openTable('memories');
    const { countRows } = require('./services/vector-db');
    const count = await countRows(table);
    console.log(`[db] Opened existing table with ~${count} memories`);
  } catch (e) {
    console.log('[db] Creating new memories table...');

    // Create with zero vector - no Ollama needed for startup
    // First real /store call will add proper data
    const dims = config.embeddingDims || 768;
    const zeroVector = new Array(dims).fill(0);

    table = await db.createTable('memories', [{
      id: 'init_' + Date.now(),
      type: 'SYSTEM',
      content: 'Memory system initialized',
      context: '',
      tags: '[]',
      confidence: 1.0,
      sessionSource: '',
      projectPath: '',
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      accessCount: 0,
      vector: zeroVector
    }]);
    console.log('[db] Created new memories table');
  }

  return { db, table };
}

async function main() {
  try {
    const { table: t } = await initDatabase();
    table = t;
  } catch (e) {
    console.error('[db] Failed to initialize database:', e.message);
    process.exit(1);
  }

  app.locals.table = table;
  app.locals.config = config;
  app.locals.embed = embeddingService.embed;
  app.locals.startTime = startTime;

  app.post('/store', require('./routes/store'));
  app.post('/recall', require('./routes/recall'));
  app.get('/health', require('./routes/health'));
  app.get('/stats', require('./routes/stats'));
  app.get('/list', require('./routes/list'));
  app.delete('/memory/:id', require('./routes/delete'));

  const port = config.port || 8741;
  app.listen(port, () => {
    console.log(`[daemon] Memory daemon running on http://localhost:${port}`);
    console.log(`[daemon] Embedding model: ${config.embeddingModel}`);
    console.log(`[daemon] Endpoints: /store, /recall, /health, /stats, /list, /memory/:id`);
  });
}

main().catch(e => {
  console.error('[daemon] Fatal error:', e);
  process.exit(1);
});
