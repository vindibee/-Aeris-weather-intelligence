import jwt from 'jsonwebtoken';
import { db } from './db.js';

export const isProd = process.env.NODE_ENV === 'production';

/*
 * Дев-заглушка лежит в публичном репозитории, поэтому в проде она равносильна
 * отсутствию подписи: зная строку, кто угодно выпишет себе токен любого
 * пользователя. Раньше здесь был молчаливый `||`-фолбэк — забытая переменная
 * окружения тихо открывала вход всем. Теперь в проде процесс просто не
 * стартует, а в деве всё работает как прежде.
 */
const DEV_SECRET = 'aeris-dev-secret-change-me-in-production-2026';
const MIN_SECRET_LEN = 32;

function resolveSecret() {
  const fromEnv = process.env.JWT_SECRET?.trim();

  if (!isProd) return fromEnv || DEV_SECRET;

  if (!fromEnv || fromEnv === DEV_SECRET || fromEnv.length < MIN_SECRET_LEN) {
    throw new Error(
      `JWT_SECRET обязателен в production: случайная строка от ${MIN_SECRET_LEN} символов. ` +
      'Сгенерировать: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }
  return fromEnv;
}

export const JWT_SECRET = resolveSecret();
const TTL = '7d';
export const COOKIE = 'aeris_token';

export const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TTL });

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  // в проде сайт всегда за HTTPS, в деве — http://localhost, где secure-кука
  // браузером просто не сохранится
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function readToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE] ?? null;
}

/** Hard gate: 401 when there is no valid token / user. */
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Сессия истекла, войдите заново' });
  }
}

/** Soft gate: attaches req.user when possible, never blocks. */
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) ?? undefined;
    } catch { /* ignore */ }
  }
  next();
}
