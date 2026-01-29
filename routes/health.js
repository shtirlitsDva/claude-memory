const { countRows } = require('../services/vector-db');
const fs = require('fs');
const path = require('path');

module.exports = async function healthRoute(req, res) {
  const { table, config, startTime } = req.app.locals;

  try {
    const memoryCount = await countRows(table);

    let vectorDbSize = 'unknown';
    try {
      const dbPath = path.join(__dirname, '..', 'data', 'memories.lance');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        if (stats.isDirectory()) {
          let totalSize = 0;
          const files = fs.readdirSync(dbPath);
          for (const file of files) {
            const filePath = path.join(dbPath, file);
            const fileStats = fs.statSync(filePath);
            totalSize += fileStats.size;
          }
          vectorDbSize = `${(totalSize / 1024 / 1024).toFixed(2)}MB`;
        }
      }
    } catch {}

    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      memoryCount,
      embeddingModel: config.embeddingModel,
      vectorDbSize
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
};
