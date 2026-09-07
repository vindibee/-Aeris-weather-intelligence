import 'dotenv/config';
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
import { locationsRouter } from './routes/locations.js';

const PORT = Number(process.env.PORT ?? 4000);
const ORIGINS = (process.env.CORS_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
  .split(',').map((s) => s.trim()).filter(Boolean);

// Vite слушает на 0.0.0.0, поэтому сайт открывается и по адресу машины в
// локальной сети. Пускаем такие origin'ы на dev/preview-портах, чтобы не
// прописывать очередной IP руками каждый раз, когда роутер выдаёт новый.
const DEV_PORTS = new Set(['5173', '4173']);
const LAN_HOST = /^(?:localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;            // curl, health-чеки, same-origin
  if (ORIGINS.includes(origin)) return true;
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
app.use('/api/locations', locationsRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

app.use((err, _req, res, _next) => {
  console.error('[api] unhandled:', err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`\n  Aeris API  ->  http://localhost:${PORT}/api/health`);
  console.log(`  CORS       ->  ${ORIGINS.join(', ')} + локальная сеть :5173/:4173\n`);
});
