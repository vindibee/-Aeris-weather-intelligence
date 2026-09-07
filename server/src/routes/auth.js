import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db, publicUser } from '../lib/db.js';
import { signToken, cookieOptions, COOKIE, requireAuth } from '../lib/auth.js';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте через несколько минут.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Имя минимум 2 символа').max(60),
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(8, 'Пароль минимум 8 символов').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

function issue(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE, token, cookieOptions);
  return token;
}

authRouter.post('/register', limiter, (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, email, password } = parsed.data;

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Такой email уже зарегистрирован' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const hue = Math.floor(Math.random() * 360);
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (email, name, password_hash, avatar_hue) VALUES (?, ?, ?, ?)')
    .run(email, name, hash, hue);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)')
    .run(user.id, 'account_created', 'Регистрация через веб-форму');

  const token = issue(res, user);
  res.status(201).json({ user: publicUser(user), token });
});

authRouter.post('/login', limiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password } = parsed.data;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Compare against a dummy hash when the user is missing to keep timing uniform.
  const ok = user
    ? bcrypt.compareSync(password, user.password_hash)
    : bcrypt.compareSync(password, '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
  if (!user || !ok) return res.status(401).json({ error: 'Неверный email или пароль' });

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)')
    .run(user.id, 'login', req.headers['user-agent']?.slice(0, 120) ?? null);

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = issue(res, fresh);
  res.json({ user: publicUser(fresh), token });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const prefsSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  avatarHue: z.number().int().min(0).max(360).optional(),
  // null — «не указан»: тогда «Одеватор» показывает обе модели
  gender: z.enum(['male', 'female']).nullable().optional(),
  home: z.object({ lat: z.number(), lon: z.number(), name: z.string() }).nullable().optional(),
});

authRouter.patch('/me', requireAuth, (req, res) => {
  const parsed = prefsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const p = parsed.data;

  const sets = [];
  const vals = [];
  if (p.name !== undefined) { sets.push('name = ?'); vals.push(p.name); }
  if (p.units !== undefined) { sets.push('units = ?'); vals.push(p.units); }
  if (p.theme !== undefined) { sets.push('theme = ?'); vals.push(p.theme); }
  if (p.avatarHue !== undefined) { sets.push('avatar_hue = ?'); vals.push(p.avatarHue); }
  if (p.gender !== undefined) { sets.push('gender = ?'); vals.push(p.gender); }
  if (p.home !== undefined) {
    sets.push('home_lat = ?', 'home_lon = ?', 'home_name = ?');
    vals.push(p.home?.lat ?? null, p.home?.lon ?? null, p.home?.name ?? null);
  }
  if (sets.length) {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.user.id);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

authRouter.get('/activity', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT kind, detail, created_at FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT 20')
    .all(req.user.id);
  res.json({ activity: rows });
});
