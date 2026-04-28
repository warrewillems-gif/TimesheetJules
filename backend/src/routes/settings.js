const express = require('express');
const router = express.Router();
const { queryGet, runSql } = require('../database');

// GET /api/settings/uurtarief
router.get('/uurtarief', (req, res) => {
  const row = queryGet(req.db, 'SELECT value FROM settings WHERE key = ?', ['uurtarief']);
  res.json({ uurtarief: row ? Number(row.value) : 35 });
});

// PUT /api/settings/uurtarief
router.put('/uurtarief', (req, res) => {
  const { uurtarief } = req.body;
  if (uurtarief == null || isNaN(Number(uurtarief)) || Number(uurtarief) < 0) {
    return res.status(400).json({ error: 'Uurtarief moet een positief getal zijn' });
  }
  runSql(req.db, `INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['uurtarief', String(Number(uurtarief))]
  );
  res.json({ uurtarief: Number(uurtarief) });
});

module.exports = router;
