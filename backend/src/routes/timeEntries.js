const express = require('express');
const router = express.Router();
const { queryAll, queryGet, runSql } = require('../database');

// GET /api/time-entries?maand=2026-03 - Alle entries voor een maand
router.get('/', (req, res) => {
  const { maand } = req.query;
  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return res.status(400).json({ error: 'maand parameter verplicht (formaat: YYYY-MM)' });
  }

  const entries = queryAll(req.db, `
    SELECT te.*, s.projectId, p.clientId
    FROM time_entries te
    JOIN subprojects s ON te.subprojectId = s.id
    JOIN projects p ON s.projectId = p.id
    WHERE te.datum LIKE ? || '%'
  `, [maand]);

  res.json(entries);
});

// PUT /api/time-entries - Upsert entry
router.put('/', (req, res) => {
  const { subprojectId, datum, werkelijkeUren, gefactureerdeUren } = req.body;

  if (!subprojectId || !datum) {
    return res.status(400).json({ error: 'subprojectId en datum zijn verplicht' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return res.status(400).json({ error: 'datum moet formaat YYYY-MM-DD hebben' });
  }

  const werkelijk = werkelijkeUren !== undefined ? Number(werkelijkeUren) : 0;
  const gefactureerd = gefactureerdeUren !== undefined ? Number(gefactureerdeUren) : 0;

  if (isNaN(werkelijk) || isNaN(gefactureerd)) {
    return res.status(400).json({ error: 'Uren moeten numeriek zijn' });
  }

  // If both are 0, delete the entry if it exists
  if (werkelijk === 0 && gefactureerd === 0) {
    runSql(req.db, 'DELETE FROM time_entries WHERE subprojectId = ? AND datum = ?', [Number(subprojectId), datum]);
    return res.json({ deleted: true });
  }

  runSql(req.db, `
    INSERT INTO time_entries (subprojectId, datum, werkelijkeUren, gefactureerdeUren)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(subprojectId, datum) DO UPDATE SET
      werkelijkeUren = excluded.werkelijkeUren,
      gefactureerdeUren = excluded.gefactureerdeUren
  `, [Number(subprojectId), datum, werkelijk, gefactureerd]);

  const entry = queryGet(req.db,
    'SELECT * FROM time_entries WHERE subprojectId = ? AND datum = ?',
    [Number(subprojectId), datum]
  );

  res.json(entry);
});

module.exports = router;
