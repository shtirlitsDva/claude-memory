const { searchMemories } = require('../services/vector-db');

module.exports = async function recallRoute(req, res) {
  const { table, config, embed } = req.app.locals;
  const startTime = Date.now();

  const {
    query,
    minSimilarity = config.minSimilarity,
    maxResults = config.maxResults,
    filters = {}
  } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query required' });
  }

  try {
    const embedding = await embed(query);

    const memories = await searchMemories(table, embedding, minSimilarity, maxResults, filters);

    const results = memories.map(m => ({
      id: m.id,
      type: m.type,
      content: m.content,
      context: m.context || undefined,
      similarity: Math.round(m.similarity * 100) / 100,
      confidence: m.confidence
    }));

    const queryTimeMs = Date.now() - startTime;

    if (results.length > 0) {
      console.log(`[recall] Found ${results.length} memories (${queryTimeMs}ms), top: ${results[0].similarity}`);
    }

    res.json({
      memories: results,
      queryTimeMs
    });

  } catch (error) {
    console.error('[recall] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
