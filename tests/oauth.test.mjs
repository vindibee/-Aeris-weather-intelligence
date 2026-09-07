/**
 * Тесты проверки подписи Telegram Login Widget.
 *
 * Подпись — единственное, что отделяет настоящий вход от подделки, поэтому её
 * проверяем без сети: собираем корректный payload тем же алгоритмом, что и
 * Telegram, и убеждаемся, что подделки отвергаются.
 *
 *   node --test tests/oauth.test.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { verifyTelegramAuth, OAuthError } from '../server/src/lib/oauth.js';

const BOT_TOKEN = 'test:AAH-fake-token-for-signature-checks';

/** Подписывает набор полей так же, как это делает Telegram. */
function sign(fields, token = BOT_TOKEN) {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(token).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return { ...fields, hash };
}

const freshFields = (extra = {}) => ({
  id: 123456789,
  first_name: 'Дмитрий',
  username: 'vindibee',
  auth_date: Math.floor(Date.now() / 1000),
  ...extra,
});

test('корректная подпись принимается и профиль разбирается', () => {
  const payload = sign(freshFields({ last_name: 'Тестовый', photo_url: 'https://t.me/i/x.jpg' }));
  const profile = verifyTelegramAuth(payload, BOT_TOKEN);

  assert.equal(profile.providerId, '123456789');
  assert.equal(profile.name, 'Дмитрий Тестовый');
  assert.equal(profile.username, 'vindibee');
  assert.equal(profile.avatarUrl, 'https://t.me/i/x.jpg');
  assert.equal(profile.email, null, 'Telegram почту не отдаёт');
});

test('имя собирается из username, если нет first_name', () => {
  const payload = sign({ id: 1, username: 'someone', auth_date: Math.floor(Date.now() / 1000) });
  assert.equal(verifyTelegramAuth(payload, BOT_TOKEN).name, 'someone');
});

test('подделанное поле ломает подпись', () => {
  const payload = sign(freshFields());
  payload.id = 987654321; // подменяем пользователя, hash оставляем прежний
  assert.throws(() => verifyTelegramAuth(payload, BOT_TOKEN), OAuthError);
});

test('подпись чужим токеном не проходит', () => {
  const payload = sign(freshFields(), 'other:token');
  assert.throws(() => verifyTelegramAuth(payload, BOT_TOKEN), OAuthError);
});

test('отсутствующий hash отвергается', () => {
  assert.throws(() => verifyTelegramAuth(freshFields(), BOT_TOKEN), OAuthError);
});

test('устаревшие данные отвергаются', () => {
  const dayAgo = Math.floor(Date.now() / 1000) - 90_000;
  const payload = sign(freshFields({ auth_date: dayAgo }));
  assert.throws(
    () => verifyTelegramAuth(payload, BOT_TOKEN),
    (e) => e instanceof OAuthError && /устарел/.test(e.message)
  );
});

test('без auth_date вход не проходит', () => {
  const payload = sign({ id: 5, first_name: 'X' });
  assert.throws(() => verifyTelegramAuth(payload, BOT_TOKEN), OAuthError);
});

test('без токена бота вход отключён', () => {
  const payload = sign(freshFields());
  assert.throws(
    () => verifyTelegramAuth(payload, ''),
    (e) => e instanceof OAuthError && e.status === 503
  );
});

test('hash неверной длины не роняет проверку', () => {
  const payload = { ...freshFields(), hash: 'abcd' };
  assert.throws(() => verifyTelegramAuth(payload, BOT_TOKEN), OAuthError);
});
