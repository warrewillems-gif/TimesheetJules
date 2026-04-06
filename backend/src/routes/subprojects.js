const express = require('express');
const router = express.Router();
const { queryAll, queryGet, runSql } = require('../database');

// POST /api/subprojects - Nieuw subproject aanmaken
router.post('/', (req, res) => {
  const { projectId, naam } = req.body;
  if (!projectId || !naam || !naam.trim()) {
    return res.status(400).json({ error: 'projectId en naam zijn verplicht' });
  }
  const project = queryGet(req.db, 'SELECT * FROM projects WHERE id = ?', [Number(projectId)]);
  if (!project) return res.status(404).json({ error: 'Project niet gevonden' });

  const result = runSql(req.db, 'INSERT INTO subprojects (projectId, naam) VALUES (?, ?)', [Number(projectId), naam.trim()]);
  const subproject = queryGet(req.db, 'SELECT * FROM subprojects WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(subproject);
});

// PUT /api/subprojects/:id - Subproject bewerken
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { naam, actief } = req.body;
  const subproject = queryGet(req.db, 'SELECT * FROM subprojects WHERE id = ?', [Number(id)]);
  if (!subproject) return res.status(404).json({ error: 'Subproject niet gevonden' });

  const newNaam = naam !== undefined ? naam.trim() : subproject.naam;
  const newActief = actief !== undefined ? (actief ? 1 : 0) : subproject.actief;

  runSql(req.db, 'UPDATE subprojects SET naam = ?, actief = ? WHERE id = ?', [newNaam, newActief, Number(id)]);
  const updated = queryGet(req.db, 'SELECT * FROM subprojects WHERE id = ?', [Number(id)]);
  res.json(updated);
});

// DELETE /api/subprojects/:id - Subproject deactiveren
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const subproject = queryGet(req.db, 'SELECT * FROM subprojects WHERE id = ?', [Number(id)]);
  if (!subproject) return res.status(404).json({ error: 'Subproject niet gevonden' });

  runSql(req.db, 'UPDATE subprojects SET actief = 0 WHERE id = ?', [Number(id)]);
  res.json({ success: true });
});

// DELETE /api/subprojects/:id/permanent - Subproject permanent verwijderen
router.delete('/:id/permanent', (req, res) => {
  const { id } = req.params;
  const sub = queryGet(req.db, 'SELECT * FROM subprojects WHERE id = ?', [Number(id)]);
  if (!sub) return res.status(404).json({ error: 'Subproject niet gevonden' });

  runSql(req.db, 'DELETE FROM time_entries WHERE subprojectId = ?', [Number(id)]);
  runSql(req.db, 'DELETE FROM subprojects WHERE id = ?', [Number(id)]);
  res.json({ success: true });
});

module.exports = router;
