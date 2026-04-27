const express = require('express');
const router = express.Router();
const { queryAll, queryGet, runSql } = require('../database');

// GET all costs (optionally filter by jaar)
router.get('/', (req, res) => {
  try {
    const { jaar } = req.query;
    let rows;
    if (jaar) {
      rows = queryAll(req.db, `SELECT * FROM costs WHERE datum LIKE ? ORDER BY datum DESC`, [`${jaar}%`]);
    } else {
      rows = queryAll(req.db, `SELECT * FROM costs ORDER BY datum DESC`);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET cost by id
router.get('/:id', (req, res) => {
  try {
    const row = queryGet(req.db, `SELECT * FROM costs WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Kost niet gevonden' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create cost
router.post('/', (req, res) => {
  try {
    const { omschrijving, bedrag, type, datum } = req.body;
    if (!omschrijving || bedrag == null || !type || !datum) {
      return res.status(400).json({ error: 'Omschrijving, bedrag, type en datum zijn verplicht' });
    }
    if (!['eenmalig', 'maandelijks'].includes(type)) {
      return res.status(400).json({ error: 'Type moet "eenmalig" of "maandelijks" zijn' });
    }
    const { lastInsertRowid } = runSql(
      req.db,
      `INSERT INTO costs (omschrijving, bedrag, type, datum) VALUES (?, ?, ?, ?)`,
      [omschrijving, Number(bedrag), type, datum]
    );
    const row = queryGet(req.db, `SELECT * FROM costs WHERE id = ?`, [lastInsertRowid]);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update cost
router.put('/:id', (req, res) => {
  try {
    const { omschrijving, bedrag, type, datum, actief } = req.body;
    const existing = queryGet(req.db, `SELECT * FROM costs WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Kost niet gevonden' });

    const newOmschrijving = omschrijving ?? existing.omschrijving;
    const newBedrag = bedrag != null ? Number(bedrag) : existing.bedrag;
    const newType = type ?? existing.type;
    const newDatum = datum ?? existing.datum;
    const newActief = actief != null ? actief : existing.actief;

    if (!['eenmalig', 'maandelijks'].includes(newType)) {
      return res.status(400).json({ error: 'Type moet "eenmalig" of "maandelijks" zijn' });
    }

    runSql(
      req.db,
      `UPDATE costs SET omschrijving = ?, bedrag = ?, type = ?, datum = ?, actief = ? WHERE id = ?`,
      [newOmschrijving, newBedrag, newType, newDatum, newActief, req.params.id]
    );
    const row = queryGet(req.db, `SELECT * FROM costs WHERE id = ?`, [req.params.id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE cost
router.delete('/:id', (req, res) => {
  try {
    const existing = queryGet(req.db, `SELECT * FROM costs WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Kost niet gevonden' });
    runSql(req.db, `DELETE FROM costs WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET costs summary for a year (monthly + yearly totals)
router.get('/summary/:jaar', (req, res) => {
  try {
    const jaar = req.params.jaar;

    // Get all costs for the year
    const allCosts = queryAll(req.db, `SELECT * FROM costs WHERE actief = 1 ORDER BY datum`);

    // Build monthly totals
    const maanden = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${jaar}-${String(m).padStart(2, '0')}`;
      maanden[key] = { eenmalig: 0, maandelijks: 0, totaal: 0 };
    }

    for (const cost of allCosts) {
      if (cost.type === 'eenmalig') {
        // One-time costs count only in their month
        const costMonth = cost.datum.substring(0, 7); // "YYYY-MM"
        if (costMonth.startsWith(jaar) && maanden[costMonth]) {
          maanden[costMonth].eenmalig += cost.bedrag;
          maanden[costMonth].totaal += cost.bedrag;
        }
      } else if (cost.type === 'maandelijks') {
        // Monthly/subscription costs: apply from their start date onwards
        const startDate = cost.datum; // "YYYY-MM-DD"
        for (let m = 1; m <= 12; m++) {
          const key = `${jaar}-${String(m).padStart(2, '0')}`;
          // Last day of this month for comparison
          const monthEnd = `${key}-31`;
          if (startDate <= monthEnd) {
            maanden[key].maandelijks += cost.bedrag;
            maanden[key].totaal += cost.bedrag;
          }
        }
      }
    }

    let jaarTotaal = 0;
    let jaarEenmalig = 0;
    let jaarMaandelijks = 0;
    for (const key of Object.keys(maanden)) {
      jaarTotaal += maanden[key].totaal;
      jaarEenmalig += maanden[key].eenmalig;
      jaarMaandelijks += maanden[key].maandelijks;
    }

    res.json({
      jaar: Number(jaar),
      maanden,
      jaarTotaal,
      jaarEenmalig,
      jaarMaandelijks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
