// db.js
// Sets up the SQLite database connection and makes sure our tables exist.
// This is the ONLY file that talks directly to the database.

const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// The database file will be created automatically in /backend on first run.
const dbPath = path.join(__dirname, "database.sqlite");
const db = new DatabaseSync(dbPath);

// Recommended pragma for better reliability with concurrent reads/writes.
// node:sqlite has no .pragma() helper, so we run it as a plain statement.
db.exec("PRAGMA journal_mode = WAL;");

// Create the "agents" table if it doesn't exist yet.
// tone/audience/frequencyMinutes/contentStyle are optional — they hold
// the extra configuration produced by the agent's planner.js (prompt ->
// config), while name/domain remain the original required fields.
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    tone TEXT,
    audience TEXT,
    frequencyMinutes INTEGER,
    contentStyle TEXT,
    createdAt TEXT NOT NULL
  )
`);

// Migration: if this is an existing database created before the columns
// above were added, add any missing ones in place. This never touches
// existing rows or drops data — it only adds new nullable columns.
const existingAgentColumns = db.prepare("PRAGMA table_info(agents)").all().map((col) => col.name);
const optionalAgentColumns = [
  ["tone", "TEXT"],
  ["audience", "TEXT"],
  ["frequencyMinutes", "INTEGER"],
  ["contentStyle", "TEXT"],
];
for (const [columnName, columnType] of optionalAgentColumns) {
  if (!existingAgentColumns.includes(columnName)) {
    db.exec(`ALTER TABLE agents ADD COLUMN ${columnName} ${columnType}`);
  }
}

// Create the "posts" table if it doesn't exist yet.
// sources is stored as a JSON string because SQLite has no array type.
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    text TEXT NOT NULL,
    rationale TEXT,
    sources TEXT,
    FOREIGN KEY (agentId) REFERENCES agents(id)
  )
`);

module.exports = db;
