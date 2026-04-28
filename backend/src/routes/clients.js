const express = require('express');
const router = express.Router();
const { queryAll, queryGet, runSql } = require('../database');

// GET /api/clients/hierarchy?maand=2026-03 - Full hierarchy with time entries
router.get('/hierarchy', (req, res) => {
  const { maand } = req.query;
  if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
    return res.status(400).json({ error: 'maand parameter verplicht (formaat: YYYY-MM)' });
  }

  const clients = queryAll(req.db, 'SELECT * FROM clients ORDER BY actief DESC, naam');
  const allProjects = queryAll(req.db, 'SELECT * FROM projects ORDER BY actief DESC, naam');
  const allSubprojects = queryAll(req.db, 'SELECT * FROM subprojects ORDER BY actief DESC, naam');
  const entries = queryAll(req.db, `
    SELECT te.*, s.projectId, p.clientId
    FROM time_entries te
    JOIN subprojects s ON te.subprojectId = s.id
    JOIN projects p ON s.projectId = p.id
    WHERE te.datum LIKE ? || '%'
  `, [maand]);

  // Build lookup maps
  const subsByProject = {};
  for (const s of allSubprojects) {
    if (!subsByProject[s.projectId]) subsByProject[s.projectId] = [];
    subsByProject[s.projectId].push(s);
  }

  const projectsByClient = {};
  for (const p of allProjects) {
    if (!projectsByClient[p.clientId]) projectsByClient[p.clientId] = [];
    projectsByClient[p.clientId].push({ ...p, subprojects: subsByProject[p.id] || [] });
  }

  const hierarchy = clients.map(c => ({
    ...c,
    projects: projectsByClient[c.id] || [],
  }));

  res.json({ hierarchy, entries });
});

// GET /api/clients - Alle clients (actief eerst, dan inactief)
router.get('/', (req, res) => {
  const clients = queryAll(req.db, 'SELECT * FROM clients ORDER BY actief DESC, naam');
  res.json(clients);
});

// POST /api/clients - Nieuwe client aanmaken
router.post('/', (req, res) => {
  const { naam } = req.body;
  if (!naam || !naam.trim()) {
    return res.status(400).json({ error: 'Naam is verplicht' });
  }
  const result = runSql(req.db, 'INSERT INTO clients (naam) VALUES (?)', [naam.trim()]);
  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(client);
});

// PUT /api/clients/:id - Client bewerken
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { naam, actief } = req.body;
  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(id)]);
  if (!client) return res.status(404).json({ error: 'Client niet gevonden' });

  const newNaam = naam !== undefined ? naam.trim() : client.naam;
  const newActief = actief !== undefined ? (actief ? 1 : 0) : client.actief;

  runSql(req.db, 'UPDATE clients SET naam = ?, actief = ? WHERE id = ?', [newNaam, newActief, Number(id)]);
  const updated = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(id)]);
  res.json(updated);
});

// DELETE /api/clients/:id - Client deactiveren (soft delete)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(id)]);
  if (!client) return res.status(404).json({ error: 'Client niet gevonden' });

  runSql(req.db, 'UPDATE clients SET actief = 0 WHERE id = ?', [Number(id)]);
  res.json({ success: true });
});

// DELETE /api/clients/:id/permanent - Client permanent verwijderen
router.delete('/:id/permanent', (req, res) => {
  const { id } = req.params;
  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(id)]);
  if (!client) return res.status(404).json({ error: 'Client niet gevonden' });

  const deleteAll = req.db.transaction(() => {
    const projects = queryAll(req.db, 'SELECT id FROM projects WHERE clientId = ?', [Number(id)]);
    for (const p of projects) {
      const subs = queryAll(req.db, 'SELECT id FROM subprojects WHERE projectId = ?', [p.id]);
      for (const s of subs) {
        runSql(req.db, 'DELETE FROM time_entries WHERE subprojectId = ?', [s.id]);
      }
      runSql(req.db, 'DELETE FROM subprojects WHERE projectId = ?', [p.id]);
    }
    runSql(req.db, 'DELETE FROM projects WHERE clientId = ?', [Number(id)]);
    runSql(req.db, 'DELETE FROM clients WHERE id = ?', [Number(id)]);
  });
  deleteAll();
  res.json({ success: true });
});

// GET /api/clients/:id/projects - Projecten van een client
router.get('/:id/projects', (req, res) => {
  const { id } = req.params;
  const projects = queryAll(req.db,
    'SELECT * FROM projects WHERE clientId = ? ORDER BY actief DESC, naam',
    [Number(id)]
  );
  res.json(projects);
});

module.exports = router;
