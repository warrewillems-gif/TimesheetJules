const express = require('express');
const router = express.Router();
const { queryAll, queryGet, runSql } = require('../database');

// POST /api/projects - Nieuw project aanmaken
router.post('/', (req, res) => {
  const { clientId, naam } = req.body;
  if (!clientId || !naam || !naam.trim()) {
    return res.status(400).json({ error: 'clientId en naam zijn verplicht' });
  }
  const client = queryGet(req.db, 'SELECT * FROM clients WHERE id = ?', [Number(clientId)]);
  if (!client) return res.status(404).json({ error: 'Client niet gevonden' });

  const result = runSql(req.db, 'INSERT INTO projects (clientId, naam) VALUES (?, ?)', [Number(clientId), naam.trim()]);
  const project = queryGet(req.db, 'SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(project);
});

// PUT /api/projects/:id - Project bewerken
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { naam, actief } = req.body;
  const project = queryGet(req.db, 'SELECT * FROM projects WHERE id = ?', [Number(id)]);
  if (!project) return res.status(404).json({ error: 'Project niet gevonden' });

  const newNaam = naam !== undefined ? naam.trim() : project.naam;
  const newActief = actief !== undefined ? (actief ? 1 : 0) : project.actief;

  runSql(req.db, 'UPDATE projects SET naam = ?, actief = ? WHERE id = ?', [newNaam, newActief, Number(id)]);
  const updated = queryGet(req.db, 'SELECT * FROM projects WHERE id = ?', [Number(id)]);
  res.json(updated);
});

// DELETE /api/projects/:id - Project deactiveren
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const project = queryGet(req.db, 'SELECT * FROM projects WHERE id = ?', [Number(id)]);
  if (!project) return res.status(404).json({ error: 'Project niet gevonden' });

  runSql(req.db, 'UPDATE projects SET actief = 0 WHERE id = ?', [Number(id)]);
  res.json({ success: true });
});

// DELETE /api/projects/:id/permanent - Project permanent verwijderen
router.delete('/:id/permanent', (req, res) => {
  const { id } = req.params;
  const project = queryGet(req.db, 'SELECT * FROM projects WHERE id = ?', [Number(id)]);
  if (!project) return res.status(404).json({ error: 'Project niet gevonden' });

  const subs = queryAll(req.db, 'SELECT id FROM subprojects WHERE projectId = ?', [Number(id)]);
  for (const s of subs) {
    runSql(req.db, 'DELETE FROM time_entries WHERE subprojectId = ?', [s.id]);
  }
  runSql(req.db, 'DELETE FROM subprojects WHERE projectId = ?', [Number(id)]);
  runSql(req.db, 'DELETE FROM projects WHERE id = ?', [Number(id)]);
  res.json({ success: true });
});

// GET /api/projects/:id/subprojects - Subprojecten van een project
router.get('/:id/subprojects', (req, res) => {
  const { id } = req.params;
  const subprojects = queryAll(req.db,
    'SELECT * FROM subprojects WHERE projectId = ? ORDER BY actief DESC, naam',
    [Number(id)]
  );
  res.json(subprojects);
});

module.exports = router;
