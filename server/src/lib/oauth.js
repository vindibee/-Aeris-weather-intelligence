import crypto from 'node:crypto';
import { db } from './db.js';

/**
 * Общая логика внешних входов.
 *
 * Провайдеры разные, а модель пользователя одна: связываем по внешнему id, а
 * если его ещё нет — по подтверждённой почте, чтобы человек, зашедший сначала
 * паролем, а потом через Google, не получил вторую учётку.
 */

export class OAuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/* ------------------------------------------------------------------ */
/*  Google OAuth 2.0                                                   */
/* ------------------------------------------------------------------ */

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const googleConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback',
});

export const googleEnabled = () => {
  const c = googleConfig();
  return !!(c.clientId && c.clientSecret);
};

/** Ссылка, на которую уводим пользователя. state защищает от CSRF. */
export function googleAuthUrl(state) {
  const c = googleConfig();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH}?${params}`;
}

/** Меняет код авторизации на профиль пользователя. */
export async function googleExchange(code) {
  const c = googleConfig();
  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: c.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    throw new OAuthError(`Google отклонил обмен кода: ${body.slice(0, 200)}`, 502);
  }

  const { access_token: accessToken } = await tokenRes.json();
  if (!accessToken) throw new OAuthError('Google не вернул access_token', 502);

  const profileRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) throw new OAuthError('Не удалось получить профиль Google', 502);

  const p = await profileRes.json();
  if (!p.sub) throw new OAuthError('Профиль Google без идентификатора', 502);

  return {
    providerId: String(p.sub),
    email: p.email_verified ? String(p.email).toLowerCase() : null,
    name: p.name || p.given_name || 'Пользователь Google',
    avatarUrl: p.picture ?? null,
    locale: typeof p.locale === 'string' ? p.locale.split('-')[0] : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Telegram Login Widget                                              */
/* ------------------------------------------------------------------ */

/**
 * Проверка подписи виджета Telegram.
 *
 * Виджет присылает поля и hash. Секрет — SHA-256 от токена бота; по нему
 * считается HMAC от строки «ключ=значение», отсортированной по алфавиту.
 * Сравнение обязано быть постоянным по времени, иначе подпись подбирается
 * побайтово.
 *
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(payload, botToken) {
  if (!botToken) throw new OAuthError('Вход через Telegram не настроен', 503);

  const { hash, ...fields } = payload ?? {};
  if (!hash || typeof hash !== 'string') throw new OAuthError('Отсутствует подпись Telegram');

  const dataCheckString = Object.keys(fields)
    .filter((k) => fields[k] !== undefined && fields[k] !== null)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new OAuthError('Подпись Telegram не совпала', 401);
  }

  // Данные виджета живут сутки: старше — почти наверняка переигранный запрос
  const authDate = Number(fields.auth_date ?? 0);
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (!authDate || ageSec > 86_400) {
    throw new OAuthError('Данные Telegram устарели, повторите вход', 401);
  }

  const name = [fields.first_name, fields.last_name].filter(Boolean).join(' ').trim();
  return {
    providerId: String(fields.id),
    email: null,
    name: name || fields.username || 'Пользователь Telegram',
    avatarUrl: fields.photo_url ?? null,
    username: fields.username ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Связывание с моделью User                                          */
/* ------------------------------------------------------------------ */

const COLUMN = { google: 'google_id', telegram: 'telegram_id' };

/**
 * Находит или создаёт пользователя под внешний профиль.
 *
 * Порядок поиска: по внешнему id -> по подтверждённой почте -> создаём нового.
 * Второй шаг и делает провайдеры «связанными»: одна учётка получает и
 * google_id, и telegram_id, вместо трёх дублей на одного человека.
 */
export function upsertOAuthUser(provider, profile) {
  const column = COLUMN[provider];
  if (!column) throw new OAuthError(`Неизвестный провайдер: ${provider}`);

  const byProvider = db
    .prepare(`SELECT * FROM users WHERE ${column} = ?`)
    .get(profile.providerId);
  if (byProvider) {
    db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(byProvider.id);
    return { user: db.prepare('SELECT * FROM users WHERE id = ?').get(byProvider.id), created: false };
  }

  if (profile.email) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email);
    if (byEmail) {
      db.prepare(
        `UPDATE users SET ${column} = ?, avatar_url = COALESCE(avatar_url, ?),
         last_login_at = datetime('now') WHERE id = ?`
      ).run(profile.providerId, profile.avatarUrl, byEmail.id);
      return { user: db.prepare('SELECT * FROM users WHERE id = ?').get(byEmail.id), created: false };
    }
  }

  /*
   * Почты может не быть вовсе — Telegram её не отдаёт. Генерируем служебный
   * адрес: он не для переписки, а чтобы не ломать UNIQUE-ограничение и
   * остальной код, который считает email обязательным.
   */
  const email = profile.email ?? `${provider}_${profile.providerId}@users.aeris.local`;
  const hue = 160 + (Number(profile.providerId.slice(-3).replace(/\D/g, '')) % 180);

  const { lastInsertRowid } = db
    .prepare(
      // password_hash объявлен NOT NULL, а ALTER COLUMN в SQLite нет.
      // Пустая строка — легальное «пароль не задан»: bcrypt против неё никогда
      // не сойдётся, а providers.password корректно возвращает false.
      `INSERT INTO users (email, name, password_hash, avatar_hue, units, theme, ${column}, avatar_url, last_login_at)
       VALUES (?, ?, '', ?, 'metric', 'dark', ?, ?, datetime('now'))`
    )
    .run(email, profile.name, hue, profile.providerId, profile.avatarUrl);

  return {
    user: db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid),
    created: true,
  };
}

/** Одноразовый state для OAuth-редиректа. */
export const makeState = () => crypto.randomBytes(24).toString('base64url');
