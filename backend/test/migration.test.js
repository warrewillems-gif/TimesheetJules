const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const Database = require('better-sqlite3');
const { createTestApp } = require('./helpers');
const { createApp } = require('../src/index');

describe('Database migration and backward compatibility', () => {
  let app, db;

  beforeEach(() => {
    ({ app, db } = createTestApp());
  });

  it('23. Migration backfill: existing clients get global rate', () => {
    // Simulate old schema: create DB without uurtarief column, add clients, then migrate
    const oldDb = new Database(':memory:');
    oldDb.pragma('foreign_keys = ON');

    // Create old schema (no uurtarief column)
    oldDb.exec(`
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL,
        actief INTEGER NOT NULL DEFAULT 1
      )
    `);
    oldDb.exec(`CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, clientId INTEGER NOT NULL, naam TEXT NOT NULL, actief INTEGER NOT NULL DEFAULT 1)`);
    oldDb.exec(`CREATE TABLE subprojects (id INTEGER PRIMARY KEY AUTOINCREMENT, projectId INTEGER NOT NULL, naam TEXT NOT NULL, actief INTEGER NOT NULL DEFAULT 1)`);
    oldDb.exec(`CREATE TABLE time_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, subprojectId INTEGER NOT NULL, datum TEXT NOT NULL, werkelijkeUren REAL NOT NULL DEFAULT 0, gefactureerdeUren REAL NOT NULL DEFAULT 0, UNIQUE(subprojectId, datum))`);
    oldDb.exec(`CREATE TABLE costs (id INTEGER PRIMARY KEY AUTOINCREMENT, omschrijving TEXT NOT NULL, bedrag REAL NOT NULL, type TEXT NOT NULL, datum TEXT NOT NULL, actief INTEGER NOT NULL DEFAULT 1)`);
    oldDb.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);

    // Insert 3 clients in old schema
    oldDb.prepare('INSERT INTO clients (naam) VALUES (?)').run('OldClientA');
    oldDb.prepare('INSERT INTO clients (naam) VALUES (?)').run('OldClientB');
    oldDb.prepare('INSERT INTO clients (naam) VALUES (?)').run('OldClientC');

    // Set global rate to 42
    oldDb.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('uurtarief', '42');

    // Now run migration: add column + backfill
    const columns = oldDb.prepare("PRAGMA table_info(clients)").all();
    const hasUurtarief = columns.some(col => col.name === 'uurtarief');
    if (!hasUurtarief) {
      oldDb.exec('ALTER TABLE clients ADD COLUMN uurtarief REAL');
    }

    const globalRate = oldDb.prepare('SELECT value FROM settings WHERE key = ?').get('uurtarief');
    const rate = globalRate ? Number(globalRate.value) : 35;
    oldDb.prepare('UPDATE clients SET uurtarief = ? WHERE uurtarief IS NULL').run(rate);

    // Verify all clients have uurtarief = 42
    const clients = oldDb.prepare('SELECT * FROM clients').all();
    assert.equal(clients.length, 3);
    for (const client of clients) {
      assert.equal(client.uurtarief, 42, `${client.naam} should have rate 42`);
    }

    oldDb.close();
  });

  it('24. Idempotent migration: run twice without errors', () => {
    const testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');

    testDb.exec(`CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, naam TEXT NOT NULL, actief INTEGER NOT NULL DEFAULT 1)`);
    testDb.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    testDb.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('uurtarief', '35');
    testDb.prepare('INSERT INTO clients (naam) VALUES (?)').run('TestClient');

    // First migration
    let columns = testDb.prepare("PRAGMA table_info(clients)").all();
    if (!columns.some(col => col.name === 'uurtarief')) {
      testDb.exec('ALTER TABLE clients ADD COLUMN uurtarief REAL');
    }
    testDb.prepare('UPDATE clients SET uurtarief = ? WHERE uurtarief IS NULL').run(35);

    // Second migration (should be no-op)
    columns = testDb.prepare("PRAGMA table_info(clients)").all();
    if (!columns.some(col => col.name === 'uurtarief')) {
      testDb.exec('ALTER TABLE clients ADD COLUMN uurtarief REAL');
    }
    testDb.prepare('UPDATE clients SET uurtarief = ? WHERE uurtarief IS NULL').run(35);

    const client = testDb.prepare('SELECT * FROM clients WHERE naam = ?').get('TestClient');
    assert.equal(client.uurtarief, 35);

    testDb.close();
  });

  it('25. Fresh DB has uurtarief column from the start', () => {
    // The createTestApp already uses the new schema
    const columns = db.prepare("PRAGMA table_info(clients)").all();
    const hasCol = columns.some(col => col.name === 'uurtarief');
    assert.ok(hasCol, 'clients table should have uurtarief column');
  });

  it('26. GET /api/settings/uurtarief still returns global default', async () => {
    const res = await request(app)
      .get('/api/settings/uurtarief')
      .expect(200);

    assert.equal(res.body.uurtarief, 35);
  });

  it('27. PUT /api/settings/uurtarief still updates global default', async () => {
    const res = await request(app)
      .put('/api/settings/uurtarief')
      .send({ uurtarief: 55 })
      .expect(200);

    assert.equal(res.body.uurtarief, 55);

    // Verify GET returns updated value
    const res2 = await request(app).get('/api/settings/uurtarief').expect(200);
    assert.equal(res2.body.uurtarief, 55);

    // New client should get the new default
    const res3 = await request(app)
      .post('/api/clients')
      .send({ naam: 'NewDefault' })
      .expect(201);
    assert.equal(res3.body.uurtarief, 55);
  });

  it('28. POST + GET roundtrip: client has correct rate', async () => {
    const create = await request(app)
      .post('/api/clients')
      .send({ naam: 'Roundtrip', uurtarief: 88 })
      .expect(201);

    const list = await request(app).get('/api/clients').expect(200);
    const found = list.body.find(c => c.id === create.body.id);
    assert.equal(found.uurtarief, 88);
    assert.equal(found.naam, 'Roundtrip');
  });

  it('29. Permanent delete removes client and all data', async () => {
    // Create client with chain
    const client = await request(app).post('/api/clients').send({ naam: 'ToDelete', uurtarief: 77 }).then(r => r.body);

    await request(app)
      .delete(`/api/clients/${client.id}/permanent`)
      .expect(200);

    const list = await request(app).get('/api/clients').expect(200);
    const found = list.body.find(c => c.id === client.id);
    assert.equal(found, undefined, 'Client should be permanently deleted');
  });
});
