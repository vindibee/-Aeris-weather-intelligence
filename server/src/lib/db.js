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
    // внешние провайдеры входа: одна учётка может быть связана и с Google,
    // и с Telegram, поэтому это колонки, а не отдельная таблица провайдеров
    ['google_id', "ALTER TABLE users ADD COLUMN google_id TEXT"],
    ['telegram_id', "ALTER TABLE users ADD COLUMN telegram_id TEXT"],
    ['avatar_url', "ALTER TABLE users ADD COLUMN avatar_url TEXT"],
    ['language', "ALTER TABLE users ADD COLUMN language TEXT"],
  ];

  for (const [name, sql] of pending) {
    if (userColumns.has(name)) continue;
    db.exec(sql);
    console.log(`[db] миграция: users.${name}`);
  }

  // Уникальность внешних идентификаторов. Частичный индекс, потому что у
  // большинства учёток эти поля пустые, а NULL в SQLite уникальности не мешает.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google
      ON users(google_id) WHERE google_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram
      ON users(telegram_id) WHERE telegram_id IS NOT NULL;
  `);
}

migrate();

/**
 * Seed a demo account + a few showcase locations on first boot.
 *
 * Пароль демо-аккаунта напечатан прямо на странице входа — для локального
 * запуска это удобство, в публичном интернете это общедоступная учётка, в
 * которую пишут все подряд. Поэтому в проде она заводится только по явному
 * SEED_DEMO=1.
 */
export function seed() {
  const allowed = process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO === '1';
  if (!allowed) return;

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@aeris.app');
  if (exists) return;

  const hash = bcrypt.hashSync('demo1234', 10);
  const { lastInsertRowid: uid } = db
    .prepare(
      `INSERT INTO users (email, name, password_hash, avatar_hue, units, home_lat, home_lon, home_name)
       VALUES (?, ?, ?, ?, 'metric', ?, ?, ?)`
    )
    .run('demo@aeris.app', 'Demo Explorer', hash, 205, 50.4547, 30.5238, 'Kyiv');

  /*
   * Названия городов латиницей.
   *
   * Сохранённая локация — пользовательские данные: её имя показывается как
   * есть и переводу не подлежит, иначе человек, сохранивший «Киев», увидел
   * бы чужое написание. Но демо-аккаунт — витрина для любого языка, и
   * русские имена в нём выглядели как непереведённый интерфейс. Поэтому
   * здесь нейтральная латиница, одинаково читаемая во всех шести локалях.
   */
  const demoPlaces = [
    ['Kyiv', 'Ukraine', 'Kyiv', 50.4547, 30.5238, 'Europe/Kyiv'],
    ['London', 'United Kingdom', 'England', 51.5074, -0.1278, 'Europe/London'],
    ['Tokyo', 'Japan', 'Tokyo', 35.6895, 139.6917, 'Asia/Tokyo'],
    ['New York', 'United States', 'New York', 40.7143, -74.006, 'America/New_York'],
    ['Reykjavik', 'Iceland', 'Capital Region', 64.1355, -21.8954, 'Atlantic/Reykjavik'],
    ['Singapore', 'Singapore', null, 1.2897, 103.8501, 'Asia/Singapore'],
  ];
  const ins = db.prepare(
    `INSERT INTO locations (user_id, name, country, admin1, lat, lon, timezone, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  demoPlaces.forEach((p, i) => ins.run(uid, p[0], p[1], p[2], p[3], p[4], p[5], i));

  // detail оставляем пустым: вид события подписывается на языке интерфейса,
  // а произвольный текст отсюда переводить было бы нечем
  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)').run(
    uid, 'account_created', null
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
  avatarUrl: u.avatar_url ?? null,
  language: u.language ?? null,
  providers: {
    password: !!u.password_hash,
    google: !!u.google_id,
    telegram: !!u.telegram_id,
  },
  home: u.home_lat != null ? { lat: u.home_lat, lon: u.home_lon, name: u.home_name } : null,
  createdAt: u.created_at,
  lastLoginAt: u.last_login_at,
});
