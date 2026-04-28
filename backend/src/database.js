const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Store the database in the user's home directory so it is never inside the
// project folder and never accidentally shared/overwritten via ZIP transfers.
const DB_DIR = path.join(os.homedir(), '.timesheetjules');
const DB_PATH = path.join(DB_DIR, 'timesheet.db');

// Ensure the data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function initDatabase() {
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1
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

  // Seed default hourly rate if not set
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('uurtarief');
  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('uurtarief', '35');
  }

  return db;
}

// Helper: run query and return rows as array of objects
function queryAll(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

// Helper: run query and return first row as object or undefined
function queryGet(db, sql, params = []) {
  return db.prepare(sql).get(...params);
}

// Helper: run INSERT/UPDATE/DELETE and return { changes, lastInsertRowid }
function runSql(db, sql, params = []) {
  const result = db.prepare(sql).run(...params);
  return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
}

module.exports = { initDatabase, queryAll, queryGet, runSql };
