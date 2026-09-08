import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db, publicUser } from '../lib/db.js';
import { signToken, cookieOptions, COOKIE } from '../lib/auth.js';
import {
  OAuthError, googleAuthUrl, googleExchange, googleEnabled, googleConfig,
  verifyTelegramAuth, upsertOAuthUser, makeState,
} from '../lib/oauth.js';

export const oauthRouter = Router();

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '';

/*
 * BOT_API_SECRET — фактически мастер-ключ: по нему /telegram/issue выдаёт код
 * входа в любой аккаунт. Слабое значение здесь дороже, чем где-либо ещё,
 * поэтому в проде требуем длину, а не полагаемся на добрую волю.
 */
const BOT_SECRET = (process.env.BOT_API_SECRET || '').trim();
if (process.env.NODE_ENV === 'production' && BOT_TOKEN && BOT_SECRET.length < 32) {
  throw new Error('BOT_API_SECRET обязателен в production: случайная строка от 32 символов');
}

/*
 * Вторая линия защиты того же маршрута: запрос должен прийти с самой машины —
 * бот и API живут рядом. Смотрим адрес сокета, а не req.ip: X-Forwarded-For
 * клиент подделывает, адрес сокета нет. BOT_ISSUE_ALLOW_REMOTE=1 — осознанная
 * лазейка на случай, когда бот вынесен на другой хост.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const ALLOW_REMOTE_ISSUE = process.env.BOT_ISSUE_ALLOW_REMOTE === '1';
const isLocalCall = (req) => LOOPBACK.has(req.socket?.remoteAddress ?? '');

/** Сравнение секретов, постоянное по времени. */
function secretMatches(provided, expected) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Одноразовые state для Google-редиректа.
 *
 * Держим в памяти: значения живут минуты, переживать перезапуск им незачем, а
 * лишняя таблица в БД ради этого не нужна.
 */
const states = new Map();
const STATE_TTL = 10 * 60_000;

const rememberState = (state, redirect) => {
  states.set(state, { redirect, expires: Date.now() + STATE_TTL });
};

const consumeState = (state) => {
  const hit = states.get(state);
  states.delete(state);
  if (!hit || hit.expires < Date.now()) return null;
  return hit;
};

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of states) if (v.expires < now) states.delete(k);
}, 60_000).unref();

/** Логирует вход и выдаёт токен так же, как обычная авторизация паролем. */
function completeLogin(res, user, provider, created) {
  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)')
    .run(user.id, created ? 'register' : 'login', `через ${provider}`);

  const token = signToken(user);
  res.cookie(COOKIE, token, cookieOptions);
  return token;
}

/** Что из провайдеров вообще настроено — фронт по этому решает, показывать ли кнопки. */
oauthRouter.get('/providers', (_req, res) => {
  res.json({
    google: googleEnabled(),
    telegram: !!(BOT_TOKEN && BOT_USERNAME),
    telegramBot: BOT_USERNAME || null,
  });
});

/* ------------------------------------------------------------------ */
/*  Google                                                             */
/* ------------------------------------------------------------------ */

oauthRouter.get('/google', (req, res) => {
  if (!googleEnabled()) {
    return res.status(503).json({
      error: 'Вход через Google не настроен: задайте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET',
    });
  }
  const state = makeState();
  rememberState(state, typeof req.query.redirect === 'string' ? req.query.redirect : '/app');
  res.redirect(googleAuthUrl(state));
});

oauthRouter.get('/google/callback', async (req, res) => {
  const schema = z.object({ code: z.string().min(4), state: z.string().min(8) });
  const parsed = schema.safeParse(req.query);

  // Ошибку возвращаем на фронт параметром, а не JSON-ом: пользователь пришёл
  // сюда редиректом из браузера и должен увидеть страницу, а не текст ошибки.
  const fail = (message) =>
    res.redirect(`${WEB_ORIGIN}/login?oauth_error=${encodeURIComponent(message)}`);

  if (!parsed.success) return fail('Google вернул некорректный ответ');

  const saved = consumeState(parsed.data.state);
  if (!saved) return fail('Сессия входа устарела, попробуйте ещё раз');

  try {
    const profile = await googleExchange(parsed.data.code);
    const { user, created } = upsertOAuthUser('google', profile);
    const token = completeLogin(res, user, 'Google', created);
    res.redirect(`${WEB_ORIGIN}/oauth/done#token=${encodeURIComponent(token)}`);
  } catch (err) {
    const message = err instanceof OAuthError ? err.message : 'Не удалось войти через Google';
    fail(message);
  }
});

/* ------------------------------------------------------------------ */
/*  Telegram                                                           */
/* ------------------------------------------------------------------ */

oauthRouter.post('/telegram', (req, res) => {
  try {
    const profile = verifyTelegramAuth(req.body ?? {}, BOT_TOKEN);
    const { user, created } = upsertOAuthUser('telegram', profile);
    const token = completeLogin(res, user, 'Telegram', created);
    res.json({ user: publicUser(user), token });
  } catch (err) {
    const status = err instanceof OAuthError ? err.status : 500;
    res.status(status).json({ error: err.message ?? 'Ошибка входа через Telegram' });
  }
});

/**
 * Вход по одноразовому коду из бота.
 *
 * Бот выдаёт пользователю ссылку с кодом; фронт обменивает код на токен. Так
 * человек попадает в свой аккаунт с компьютера, не вводя пароль.
 */
const loginCodes = new Map();
const CODE_TTL = 10 * 60_000;

export function issueBotLoginCode(telegramProfile) {
  const code = makeState();
  loginCodes.set(code, { profile: telegramProfile, expires: Date.now() + CODE_TTL });
  return code;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginCodes) if (v.expires < now) loginCodes.delete(k);
}, 60_000).unref();

oauthRouter.post('/telegram/code', (req, res) => {
  const code = String(req.body?.code ?? '');
  const hit = loginCodes.get(code);
  loginCodes.delete(code);

  if (!hit || hit.expires < Date.now()) {
    return res.status(401).json({ error: 'Код входа недействителен или истёк' });
  }

  const { user, created } = upsertOAuthUser('telegram', hit.profile);
  const token = completeLogin(res, user, 'Telegram', created);
  res.json({ user: publicUser(user), token });
});

/**
 * Выдача кода ботом. Защищено общим секретом, потому что этот маршрут
 * фактически позволяет войти в любой аккаунт — снаружи он быть открытым не должен.
 */
oauthRouter.post('/telegram/issue', (req, res) => {
  if (!ALLOW_REMOTE_ISSUE && !isLocalCall(req)) {
    return res.status(403).json({ error: 'Маршрут доступен только с локального хоста' });
  }
  if (!secretMatches(req.get('x-bot-secret'), BOT_SECRET)) {
    return res.status(403).json({ error: 'Недействительный секрет бота' });
  }

  // nullish, а не optional: Telegram отдаёт отсутствующие поля как null, и
  // строгий optional() заворачивал профиль любого пользователя без фамилии
  // или юзернейма — кнопка «Войти на сайте» падала с «Некорректный профиль».
  const schema = z.object({
    id: z.union([z.string(), z.number()]),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    username: z.string().nullish(),
    photo_url: z.string().nullish(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный профиль Telegram' });

  const p = parsed.data;
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  const code = issueBotLoginCode({
    providerId: String(p.id),
    email: null,
    name: name || p.username || 'Пользователь Telegram',
    avatarUrl: p.photo_url ?? null,
    username: p.username ?? null,
  });

  res.json({ code, url: `${WEB_ORIGIN}/oauth/telegram?code=${code}`, expiresInSec: CODE_TTL / 1000 });
});

/** Конфигурация виджета для фронта. */
oauthRouter.get('/telegram/widget', (_req, res) => {
  if (!BOT_USERNAME) {
    return res.status(503).json({ error: 'TELEGRAM_BOT_USERNAME не задан' });
  }
  res.json({ bot: BOT_USERNAME, origin: WEB_ORIGIN, redirect: googleConfig().redirectUri });
});
