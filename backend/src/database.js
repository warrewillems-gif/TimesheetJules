const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Store the database in the user's home directory so it is never inside the
// project folder and never accidentally shared/overwritten via ZIP transfers.
const DB_DIR = path.join(os.homedir(), '.timesheetjules');
const DB_PATH = path.join(DB_DIR, 'timesheet.db');

// Ensure the data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db = null;

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (clientId) REFERENCES clients(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subprojects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER NOT NULL,
      naam TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (projectId) REFERENCES projects(id)
    )
  `);

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      omschrijving TEXT NOT NULL,
      bedrag REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('eenmalig', 'maandelijks')),
      datum TEXT NOT NULL,
      actief INTEGER NOT NULL DEFAULT 1
    )
  `);

  saveDatabase();
  return db;
}

// Helper: run query and return rows as array of objects
function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run query and return first row as object or undefined
function queryGet(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

// Helper: run INSERT/UPDATE/DELETE and return { changes, lastInsertRowid }
function runSql(db, sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0];
  const changes = db.getRowsModified();
  saveDatabase();
  return { lastInsertRowid: lastId, changes };
}

module.exports = { initDatabase, queryAll, queryGet, runSql, saveDatabase };
