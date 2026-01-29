module.exports = async function listRoute(req, res) {
  const { table } = req.app.locals;

  const { type, limit = 20, offset = 0 } = req.query;

  try {
    let allMemories = await table.search([0]).limit(10000).toArray();

    if (type) {
      allMemories = allMemories.filter(m => m.type === type);
    }

    allMemories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = allMemories.length;
    const paginated = allMemories.slice(Number(offset), Number(offset) + Number(limit));

    const memories = paginated.map(m => ({
      id: m.id,
      type: m.type,
      content: m.content,
      context: m.context || undefined,
      confidence: m.confidence,
      createdAt: m.createdAt,
      accessCount: m.accessCount || 0
    }));

    res.json({
      memories,
      total,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    console.error('[list] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
