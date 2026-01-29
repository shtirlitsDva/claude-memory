const { v4: uuidv4 } = require('uuid');
const { findDuplicates } = require('../services/vector-db');

module.exports = async function storeRoute(req, res) {
  const { table, config, embed } = req.app.locals;

  const { type, content, context, tags, confidence, sessionSource, projectPath } = req.body;

  if (!type || !content) {
    return res.status(400).json({ error: 'type and content required' });
  }

  const validTypes = ['GOTCHA', 'WORKING_SOLUTION', 'PATTERN', 'DECISION', 'FAILURE', 'PREFERENCE', 'SYSTEM'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `invalid type, must be one of: ${validTypes.join(', ')}` });
  }

  if (content.length > config.maxContentLength) {
    return res.status(400).json({
      error: `content too long (max ${config.maxContentLength} chars, got ${content.length})`
    });
  }

  try {
    const textToEmbed = content + (context ? ` ${context}` : '');
    const embedding = await embed(textToEmbed);

    const dupCheck = await findDuplicates(table, embedding, config.duplicateThreshold);
    if (dupCheck.isDuplicate) {
      return res.json({
        status: 'duplicate',
        existing_id: dupCheck.existingId,
        similarity: Math.round(dupCheck.similarity * 100) / 100
      });
    }

    const id = `mem_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    await table.add([{
      id,
      type,
      content,
      context: context || '',
      tags: JSON.stringify(tags || []),
      confidence: confidence || 0.85,
      sessionSource: sessionSource || '',
      projectPath: projectPath || '',
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      vector: embedding
    }]);

    console.log(`[store] Stored memory ${id}: ${type} - ${content.slice(0, 50)}...`);

    res.json({
      status: 'stored',
      id,
      embedding_dims: embedding.length
    });

  } catch (error) {
    console.error('[store] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
