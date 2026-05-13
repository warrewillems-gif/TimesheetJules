const Database = require('better-sqlite3');
const { createApp } = require('../src/index');

/**
 * Create a fresh in-memory database with the full schema and a test Express app.
 * Returns { app, db } for use in tests.
 */
function createTestApp() {
  const db = new Database(':memory:');

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1,
      uurtarief REAL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS subprojects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subprojectId INTEGER NOT NULL,
      datum TEXT NOT NULL,
      werkelijkeUren REAL NOT NULL DEFAULT 0,
      gefactureerdeUren REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (subprojectId) REFERENCES subprojects(id),
      UNIQUE(subprojectId, datum)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      omschrijving TEXT NOT NULL,
      bedrag REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('eenmalig', 'maandelijks')),
      datum TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed default hourly rate
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('uurtarief', '35');

  const app = createApp(db);
  return { app, db };
}

/**
 * Create a full client → project → subproject chain and return all IDs.
 */
function createClientChain(db, clientName, projectName, subprojectName, uurtarief) {
  const clientResult = db.prepare('INSERT INTO clients (naam, uurtarief) VALUES (?, ?)').run(clientName, uurtarief);
  const clientId = clientResult.lastInsertRowid;

  const projectResult = db.prepare('INSERT INTO projects (clientId, naam) VALUES (?, ?)').run(clientId, projectName);
  const projectId = projectResult.lastInsertRowid;

  const subResult = db.prepare('INSERT INTO subprojects (projectId, naam) VALUES (?, ?)').run(projectId, subprojectName);
  const subprojectId = subResult.lastInsertRowid;

  return { clientId, projectId, subprojectId };
}

/**
 * Insert a time entry directly into the database.
 */
function insertTimeEntry(db, subprojectId, datum, werkelijkeUren, gefactureerdeUren) {
  db.prepare(
    'INSERT INTO time_entries (subprojectId, datum, werkelijkeUren, gefactureerdeUren) VALUES (?, ?, ?, ?)'
  ).run(subprojectId, datum, werkelijkeUren, gefactureerdeUren);
}

module.exports = { createTestApp, createClientChain, insertTimeEntry };
