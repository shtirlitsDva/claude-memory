function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

async function findDuplicates(table, embedding, threshold) {
  try {
    const results = await table.search(embedding).limit(5).toArray();

    for (const result of results) {
      const sim = cosineSimilarity(embedding, result.vector);
      if (sim >= threshold) {
        return { isDuplicate: true, existingId: result.id, similarity: sim };
      }
    }
  } catch (e) {
    console.error('[vector-db] findDuplicates error:', e.message);
  }

  return { isDuplicate: false };
}

async function searchMemories(table, embedding, minSimilarity, maxResults, filters = {}) {
  try {
    const results = await table.search(embedding).limit(maxResults * 3).toArray();

    return results
      .map(r => ({
        ...r,
        similarity: cosineSimilarity(embedding, r.vector)
      }))
      .filter(r => r.similarity >= minSimilarity)
      .filter(r => {
        if (filters.types && filters.types.length > 0 && !filters.types.includes(r.type)) return false;
        if (filters.projectPath && r.projectPath && r.projectPath !== filters.projectPath) return false;
        return true;
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  } catch (e) {
    console.error('[vector-db] searchMemories error:', e.message);
    return [];
  }
}

async function countRows(table) {
  try {
    const all = await table.search([0]).limit(10000).toArray();
    return all.length;
  } catch {
    return 0;
  }
}

module.exports = { findDuplicates, searchMemories, cosineSimilarity, countRows };
