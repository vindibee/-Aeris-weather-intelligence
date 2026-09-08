import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { seed } from './lib/db.js';
import { cacheStats } from './lib/cache.js';
import { authRouter } from './routes/auth.js';
import { weatherRouter } from './routes/weather.js';
import { spaceRouter } from './routes/space.js';
import { oauthRouter } from './routes/oauth.js';
import { locationsRouter } from './routes/locations.js';

const PORT = Number(process.env.PORT ?? 4000);
const IS_PROD = process.env.NODE_ENV === 'production';

// В проде список origin'ов должен быть объявлен явно: дефолт с localhost там
// заведомо неверен, а молча пустить всё — худший из вариантов.
if (IS_PROD && !process.env.CORS_ORIGINS?.trim()) {
  throw new Error('CORS_ORIGINS обязателен в production, например: https://aeris.example.com');
}

/*
 * Origin в заголовке браузера — это всегда схема + хост + порт, без пути и без
 * завершающего слеша. Поэтому значение из переменной приводим к тому же виду:
 * лишний слеш в конце — самая частая опечатка, и молча ронять из-за неё весь
 * межсайтовый доступ незачем. А вот схему дописать за пользователя нельзя:
 * http и https — разные origin'ы, угадывание тут означало бы пустить лишнее.
 */
const ORIGINS = (process.env.CORS_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
  .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);

const schemeless = ORIGINS.filter((o) => !/^https?:\/\//.test(o));
if (schemeless.length) {
  console.warn(
    `[cors] в CORS_ORIGINS есть записи без схемы: ${schemeless.join(', ')}. ` +
    'Браузер шлёт Origin вида https://example.com — такие записи не совпадут никогда.'
  );
}

// Vite слушает на 0.0.0.0, поэтому сайт открывается и по адресу машины в
// локальной сети. Пускаем такие origin'ы на dev/preview-портах, чтобы не
// прописывать очередной IP руками каждый раз, когда роутер выдаёт новый.
const DEV_PORTS = new Set(['5173', '4173']);
const LAN_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;            // curl, health-чеки, same-origin
  if (ORIGINS.includes(origin)) return true;
  // Послабление для локальной сети — сугубо про удобство разработки с телефона.
  // В проде оно не нужно и работает только явный вайтлист.
  if (IS_PROD) return false;
  try {
    const u = new URL(origin);
    return u.protocol === 'http:' && DEV_PORTS.has(u.port) && LAN_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

seed();

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
  credentials: true,
}));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Global backstop; the auth router adds a much tighter limit of its own.
app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов, притормозите' },
}));

const started = Date.now();
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'aeris-api',
    uptimeSec: Math.round((Date.now() - started) / 1000),
    cache: cacheStats(),
    providers: ['open-meteo', 'open-meteo-air-quality', 'open-meteo-geocoding', 'rainviewer'],
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/space', spaceRouter);
app.use('/api/auth', oauthRouter);
app.use('/api/locations', locationsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

/*
 * Раздача собранного фронта тем же процессом.
 *
 * Один домен на сайт и API — это не только экономия сервиса на бесплатном
 * хостинге: пропадает межсайтовость, а с ней и необходимость ослаблять куку
 * до SameSite=None. В деве статику отдаёт Vite, поэтому здесь она включается
 * только в проде или явным SERVE_WEB=1.
 */
const WEB_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');
const SERVE_WEB = (IS_PROD || process.env.SERVE_WEB === '1') && existsSync(WEB_DIST);

if (SERVE_WEB) {
  // хешированные ассеты кэшируем надолго, index.html — никогда: иначе после
  // выката пользователь получит старую разметку со ссылками на новые чанки
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1y' }));
  app.get('*', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(join(WEB_DIST, 'index.html'));
  });
} else if (IS_PROD) {
  console.warn(`[web] ${WEB_DIST} не найден — сначала выполните npm run build`);
}

app.use((err, _req, res, _next) => {
  console.error('[api] unhandled:', err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`\n  Aeris API  ->  http://localhost:${PORT}/api/health`);
  if (SERVE_WEB) console.log(`  Сайт       ->  http://localhost:${PORT}/`);
  const lan = IS_PROD ? '' : ' + локальная сеть :5173/:4173';
  console.log(`  CORS       ->  ${ORIGINS.join(', ')}${lan}`);
  console.log('');
});
