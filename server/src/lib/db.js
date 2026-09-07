import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../../data/aeris.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

// node --watch поднимает новый процесс раньше, чем старый отпускает WAL-лок:
// без busy_timeout старт падает с "database is locked" на каждом сохранении файла.
db.exec(`
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    avatar_hue    INTEGER NOT NULL DEFAULT 210,
    units         TEXT    NOT NULL DEFAULT 'metric',
    theme         TEXT    NOT NULL DEFAULT 'dark',
    home_lat      REAL,
    home_lon      REAL,
    home_name     TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS locations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    country    TEXT,
    admin1     TEXT,
    lat        REAL    NOT NULL,
    lon        REAL    NOT NULL,
    timezone   TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);

  CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT    NOT NULL,
    detail     TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

/**
 * Лёгкие миграции для уже существующих баз.
 *
 * CREATE TABLE IF NOT EXISTS не добавляет колонки в таблицу, которая уже
 * создана, поэтому новые поля доводим отдельно. Список идемпотентный: колонка
 * добавляется, только если её ещё нет.
 */
function migrate() {
  const columns = (table) =>
    new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));

  const userColumns = columns('users');
  const pending = [
    // пол нужен «Одеватору»: он выбирает, какую 3D-модель показать
    ['gender', "ALTER TABLE users ADD COLUMN gender TEXT"],
  ];

  for (const [name, sql] of pending) {
    if (userColumns.has(name)) continue;
    db.exec(sql);
    console.log(`[db] миграция: users.${name}`);
  }
}

migrate();

/** Seed a demo account + a few showcase locations on first boot. */
export function seed() {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@aeris.app');
  if (exists) return;

  const hash = bcrypt.hashSync('demo1234', 10);
  const { lastInsertRowid: uid } = db
    .prepare(
      `INSERT INTO users (email, name, password_hash, avatar_hue, units, home_lat, home_lon, home_name)
       VALUES (?, ?, ?, ?, 'metric', ?, ?, ?)`
    )
    .run('demo@aeris.app', 'Demo Explorer', hash, 205, 50.4547, 30.5238, 'Киев');

  const demoPlaces = [
    ['Киев', 'Украина', 'Киев', 50.4547, 30.5238, 'Europe/Kyiv'],
    ['Лондон', 'Великобритания', 'England', 51.5074, -0.1278, 'Europe/London'],
    ['Токио', 'Япония', 'Tokyo', 35.6895, 139.6917, 'Asia/Tokyo'],
    ['Нью-Йорк', 'США', 'New York', 40.7143, -74.006, 'America/New_York'],
    ['Рейкьявик', 'Исландия', 'Capital Region', 64.1355, -21.8954, 'Atlantic/Reykjavik'],
    ['Сингапур', 'Сингапур', null, 1.2897, 103.8501, 'Asia/Singapore'],
  ];
  const ins = db.prepare(
    `INSERT INTO locations (user_id, name, country, admin1, lat, lon, timezone, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  demoPlaces.forEach((p, i) => ins.run(uid, p[0], p[1], p[2], p[3], p[4], p[5], i));

  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)').run(
    uid, 'account_created', 'Демо-аккаунт создан автоматически'
  );
  console.log('[db] seeded demo account -> demo@aeris.app / demo1234');
}

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarHue: u.avatar_hue,
  units: u.units,
  theme: u.theme,
  gender: u.gender ?? null,
  home: u.home_lat != null ? { lat: u.home_lat, lon: u.home_lon, name: u.home_name } : null,
  createdAt: u.created_at,
  lastLoginAt: u.last_login_at,
});
