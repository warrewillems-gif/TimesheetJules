const express = require('express');
const router = express.Router();
const { queryAll, queryGet } = require('../database');

// GET /api/reports/client/:id?maand=2026-03 - Maandrapport per client
router.get('/client/:id', (req, res) => {
  const { id } = req.params;
  const { maand } = req.query;

  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return res.status(400).json({ error: 'maand parameter verplicht (formaat: YYYY-MM)' });
  }

  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(id)]);
  if (!client) return res.status(404).json({ error: 'Client niet gevonden' });

  const projects = queryAll(req.db,
    'SELECT * FROM projects WHERE clientId = ? ORDER BY naam',
    [Number(id)]
  );

  const report = {
    client: { id: client.id, naam: client.naam },
    maand,
    projecten: [],
    totaal: 0,
  };

  for (const project of projects) {
    const subprojects = queryAll(req.db,
      'SELECT * FROM subprojects WHERE projectId = ? ORDER BY naam',
      [project.id]
    );

    const projectData = {
      id: project.id,
      naam: project.naam,
      subprojecten: [],
      totaal: 0,
    };

    for (const sub of subprojects) {
      const result = queryGet(req.db, `
        SELECT COALESCE(SUM(gefactureerdeUren), 0) as totaal
        FROM time_entries
        WHERE subprojectId = ? AND datum LIKE ? || '%'
      `, [sub.id, maand]);

      const subTotal = result.totaal;
      if (subTotal > 0) {
        projectData.subprojecten.push({
          id: sub.id,
          naam: sub.naam,
          totaal: subTotal,
        });
        projectData.totaal += subTotal;
      }
    }

    if (projectData.totaal > 0) {
      report.projecten.push(projectData);
      report.totaal += projectData.totaal;
    }
  }

  res.json(report);
});

// GET /api/reports/revenue?jaar=2026 - Revenue overview per month/year
router.get('/revenue', (req, res) => {
  const { jaar } = req.query;

  if (!jaar || !/^\d{4}$/.test(jaar)) {
    return res.status(400).json({ error: 'jaar parameter verplicht (formaat: YYYY)' });
  }

  // Per client per month
  const rows = queryAll(req.db, `
    SELECT c.id as clientId, c.naam as clientNaam,
           substr(te.datum, 1, 7) as maand,
           COALESCE(SUM(te.gefactureerdeUren), 0) as uren
    FROM time_entries te
    JOIN subprojects sp ON te.subprojectId = sp.id
    JOIN projects p ON sp.projectId = p.id
    JOIN clients c ON p.clientId = c.id
    WHERE te.datum LIKE ? || '%'
    GROUP BY c.id, substr(te.datum, 1, 7)
    ORDER BY c.naam, maand
  `, [jaar]);

  // Build structured result
  const clientsMap = {};
  let jaarTotaalUren = 0;

  for (const row of rows) {
    if (!clientsMap[row.clientId]) {
      clientsMap[row.clientId] = {
        id: row.clientId,
        naam: row.clientNaam,
        maanden: {},
        totaalUren: 0,
      };
    }
    clientsMap[row.clientId].maanden[row.maand] = row.uren;
    clientsMap[row.clientId].totaalUren += row.uren;
    jaarTotaalUren += row.uren;
  }

  res.json({
    jaar: Number(jaar),
    clients: Object.values(clientsMap),
    totaalUren: jaarTotaalUren,
  });
});

module.exports = router;
