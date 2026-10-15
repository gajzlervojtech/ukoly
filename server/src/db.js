const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'ukoly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Typy karet:
//  deadline – úkoly s termínem (a připomínkou)
//  simple   – jednoduchý seznam k odškrtnutí
//  mark     – seznam s označením (položka zůstává, jen se přepne, např. „Na NASu“)
const KINDS = ['deadline', 'simple', 'mark'];

const MIGRATIONS = [
  // v1
  `
  CREATE TABLE cards (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2FB386',
    kind TEXT NOT NULL DEFAULT 'deadline' CHECK (kind IN ('deadline','simple','mark')),
    mark_label TEXT NOT NULL DEFAULT 'Hotovo',
    preset TEXT,
    in_digest INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    variant TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    due_time TEXT,
    remind INTEGER NOT NULL DEFAULT 1,
    done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX items_card ON items(card_id, done);
  CREATE INDEX items_due ON items(due_date) WHERE done = 0;
  CREATE INDEX items_created ON items(created_at);
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
  `,
  // v2 – které zařízení položku přidalo (telefon pak neupozorňuje na vlastní položky)
  `
  ALTER TABLE items ADD COLUMN device TEXT NOT NULL DEFAULT '';
  `,
];

function migrate() {
  const current = db.pragma('user_version', { simple: true });
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

const now = () => new Date().toISOString();

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM cards').get().n;
  if (count > 0) return;
  const ins = db.prepare(`INSERT INTO cards (name, color, kind, mark_label, preset, in_digest, sort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const t = now();
  db.transaction(() => {
    ins.run('Úkoly', '#2FB386', 'deadline', 'Hotovo', 'tasks', 1, 0, t, t);
    ins.run('Filmy a seriály', '#6C8CF5', 'mark', 'Na NASu', 'media', 0, 1, t, t);
  })();
}

migrate();
seed();

function getSetting(key, fallback = null) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? r.value : fallback;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}

module.exports = { db, DATA_DIR, KINDS, now, getSetting, setSetting };
