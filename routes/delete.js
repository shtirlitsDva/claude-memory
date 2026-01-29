module.exports = async function deleteRoute(req, res) {
  const { table } = req.app.locals;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'id required' });
  }

  try {
    await table.delete(`id = '${id}'`);

    console.log(`[delete] Deleted memory ${id}`);

    res.json({
      status: 'deleted',
      id
    });
  } catch (error) {
    console.error('[delete] Error:', error);
    res.status(500).json({ error: error.message });
  }
};
