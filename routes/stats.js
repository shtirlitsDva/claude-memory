module.exports = async function statsRoute(req, res) {
  const { table } = req.app.locals;

  try {
    const allMemories = await table.query().limit(10000).toArray();

    const byType = {};
    let totalConfidence = 0;
    let oldestMemory = null;
    let newestMemory = null;

    for (const mem of allMemories) {
      byType[mem.type] = (byType[mem.type] || 0) + 1;
      totalConfidence += mem.confidence || 0;

      const created = new Date(mem.createdAt);
      if (!oldestMemory || created < new Date(oldestMemory)) {
        oldestMemory = mem.createdAt;
      }
      if (!newestMemory || created > new Date(newestMemory)) {
        newestMemory = mem.createdAt;
      }
    }

    res.json({
      total: allMemories.length,
      byType,
      avgConfidence: allMemories.length > 0
        ? Math.round((totalConfidence / allMemories.length) * 100) / 100
        : 0,
      oldestMemory,
      newestMemory
    });
  } catch (error) {
    console.error('[stats] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
