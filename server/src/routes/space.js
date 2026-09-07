import { Router } from 'express';
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJson, qs } from '../lib/upstream.js';

export const spaceRouter = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK_PATH = resolve(__dirname, '../data/space_weather.json');

/**
 * Заготовленные данные.
 *
 * Читаем при старте (отсутствие файла должно ронять сервер сразу, а не в
 * момент запроса) и перечитываем, если файл изменился: node --watch следит
 * только за модулями, поэтому правки в JSON иначе не подхватывались бы до
 * ручного перезапуска — на этом легко потерять полчаса.
 */
let fallbackCache = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8'));
let fallbackMtime = statSync(FALLBACK_PATH).mtimeMs;

function loadFallback() {
  try {
    const mtime = statSync(FALLBACK_PATH).mtimeMs;
    if (mtime !== fallbackMtime) {
      fallbackCache = JSON.parse(readFileSync(FALLBACK_PATH, 'utf8'));
      fallbackMtime = mtime;
    }
  } catch {
    // битый или временно недоступный файл — работаем на последней валидной копии
  }
  return fallbackCache;
}

// DEMO_KEY у NASA работает без регистрации, но с жёстким лимитом (30 запросов
// в час на IP) — поэтому ответы кэшируем надолго и всегда готовы к отказу.
const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const INSIGHT = 'https://api.nasa.gov/insight_weather/';
const DONKI_FLR = 'https://api.nasa.gov/DONKI/FLR';
const DONKI_GST = 'https://api.nasa.gov/DONKI/GST';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

/** Опорные точки для «живой» сводки по Земле. */
const EARTH_REFERENCE = [
  { name: 'Киев', lat: 50.4547, lon: 30.5238 },
  { name: 'Лондон', lat: 51.5074, lon: -0.1278 },
  { name: 'Нью-Йорк', lat: 40.7143, lon: -74.006 },
  { name: 'Токио', lat: 35.6895, lon: 139.6917 },
  { name: 'Каир', lat: 30.0444, lon: 31.2357 },
  { name: 'Сидней', lat: -33.8688, lon: 151.2093 },
  { name: 'Верхоянск', lat: 67.5447, lon: 133.3856 },
  { name: 'Станция Восток', lat: -78.4645, lon: 106.8372 },
];

const iso = (d) => d.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/*  Живые источники. Каждый обязан либо вернуть данные, либо null —    */
/*  бросать наверх нельзя, иначе один упавший API уронит весь раздел.  */
/* ------------------------------------------------------------------ */

/**
 * Марс: метеостанция InSight. Миссия завершена в декабре 2022 года, и эндпоинт
 * теперь отдаёт пустой набор солов — ровно тот случай, ради которого и написан
 * fallback. Код остаётся рабочим: вернётся живой сол — покажем живой сол.
 */
async function fetchMars() {
  try {
    const d = await fetchJson(
      `${INSIGHT}?${qs({ api_key: NASA_KEY, feedtype: 'json', ver: '1.0' })}`,
      { ttl: 60 * 60_000, retries: 1, timeout: 9000 }
    );
    const sols = Array.isArray(d?.sol_keys) ? d.sol_keys : [];
    if (!sols.length) return null;

    const sol = sols[sols.length - 1];
    const s = d[sol];
    if (!s) return null;

    const at = s.AT ?? {};
    const pre = s.PRE ?? {};
    const hws = s.HWS ?? {};
    const has = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!has(at.av) && !has(pre.av) && !has(hws.av)) return null;

    return {
      sol: Number(sol),
      season: s.Season ?? null,
      firstUTC: s.First_UTC ?? null,
      tempMean: has(at.av) ? +at.av.toFixed(1) : null,
      tempMin: has(at.mn) ? +at.mn.toFixed(1) : null,
      tempMax: has(at.mx) ? +at.mx.toFixed(1) : null,
      // InSight отдаёт давление в паскалях, у нас в модели бары
      pressureBar: has(pre.av) ? +(pre.av / 100_000).toFixed(6) : null,
      windMax: has(hws.mx) ? +hws.mx.toFixed(1) : null,
      windMean: has(hws.av) ? +hws.av.toFixed(1) : null,
    };
  } catch {
    return null;
  }
}

/** Солнечная активность: вспышки и геомагнитные бури за последние 30 суток. */
async function fetchSolar() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60_000);
  const range = { startDate: iso(start), endDate: iso(end), api_key: NASA_KEY };

  const [flares, storms] = await Promise.all([
    fetchJson(`${DONKI_FLR}?${qs(range)}`, { ttl: 30 * 60_000, retries: 1, timeout: 9000 })
      .catch(() => null),
    fetchJson(`${DONKI_GST}?${qs(range)}`, { ttl: 30 * 60_000, retries: 1, timeout: 9000 })
      .catch(() => null),
  ]);

  if (!Array.isArray(flares) && !Array.isArray(storms)) return null;

  const kpValues = (Array.isArray(storms) ? storms : [])
    .flatMap((g) => g.allKpIndex ?? [])
    .map((k) => k.kpIndex)
    .filter((v) => typeof v === 'number');

  return {
    summary: null,
    flares: (Array.isArray(flares) ? flares : [])
      .slice(-8)
      .reverse()
      .map((f) => ({
        id: f.flrID ?? null,
        classType: f.classType ?? null,
        beginTime: f.beginTime ?? null,
        peakTime: f.peakTime ?? null,
        sourceLocation: f.sourceLocation ?? null,
      })),
    storms: (Array.isArray(storms) ? storms : [])
      .slice(-5)
      .reverse()
      .map((g) => ({
        id: g.gstID ?? null,
        startTime: g.startTime ?? null,
        maxKp: Math.max(0, ...(g.allKpIndex ?? []).map((k) => k.kpIndex ?? 0)) || null,
      })),
    kpIndex: kpValues.length ? +Math.max(...kpValues).toFixed(1) : null,
  };
}

/** Земля: живая сводка по опорным точкам через тот же Open-Meteo. */
async function fetchEarth() {
  try {
    const d = await fetchJson(
      `${OPEN_METEO}?${qs({
        latitude: EARTH_REFERENCE.map((p) => p.lat.toFixed(4)),
        longitude: EARTH_REFERENCE.map((p) => p.lon.toFixed(4)),
        current: ['temperature_2m', 'surface_pressure', 'wind_speed_10m'],
        wind_speed_unit: 'ms',
        timezone: 'GMT',
      })}`,
      { ttl: 10 * 60_000, retries: 1, timeout: 9000 }
    );

    const arr = Array.isArray(d) ? d : [d];
    const points = arr
      .map((x, i) => ({
        name: EARTH_REFERENCE[i]?.name ?? '—',
        temp: x?.current?.temperature_2m ?? null,
        pressure: x?.current?.surface_pressure ?? null,
        wind: x?.current?.wind_speed_10m ?? null,
      }))
      .filter((p) => p.temp != null);

    if (!points.length) return null;

    const temps = points.map((p) => p.temp);
    const winds = points.map((p) => p.wind).filter((v) => v != null);
    const pressures = points.map((p) => p.pressure).filter((v) => v != null);
    const coldest = points.reduce((a, b) => (b.temp < a.temp ? b : a));
    const hottest = points.reduce((a, b) => (b.temp > a.temp ? b : a));

    return {
      tempMean: +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      tempMin: +Math.min(...temps).toFixed(1),
      tempMax: +Math.max(...temps).toFixed(1),
      pressureBar: pressures.length
        ? +(pressures.reduce((a, b) => a + b, 0) / pressures.length / 1000).toFixed(4)
        : null,
      windMax: winds.length ? +Math.max(...winds).toFixed(1) : null,
      coldest: { name: coldest.name, temp: coldest.temp },
      hottest: { name: hottest.name, temp: hottest.temp },
      sampled: points.length,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Слияние живых данных с заготовкой                                  */
/* ------------------------------------------------------------------ */

const clone = (v) => JSON.parse(JSON.stringify(v));

function mergeMars(planet, live) {
  if (!live) return { ...planet, source: 'fallback', sourceNote: 'Миссия InSight завершена — показаны справочные данные NASA' };
  const metrics = { ...planet.metrics };
  if (live.tempMean != null) metrics.tempMean = live.tempMean;
  if (live.tempMin != null) metrics.tempMin = live.tempMin;
  if (live.tempMax != null) metrics.tempMax = live.tempMax;
  if (live.pressureBar != null) {
    metrics.pressureBar = live.pressureBar;
    metrics.pressureNote = `измерено InSight, сол ${live.sol}`;
  }
  if (live.windMax != null) {
    metrics.windMax = live.windMax;
    metrics.windNote = live.windMean != null ? `средняя ${live.windMean} м/с, порыв ${live.windMax} м/с` : metrics.windNote;
  }
  return {
    ...planet,
    metrics,
    live: { sol: live.sol, season: live.season, firstUTC: live.firstUTC },
    source: 'live',
    sourceNote: `NASA InSight, сол ${live.sol}`,
  };
}

function mergeEarth(planet, live) {
  if (!live) return { ...planet, source: 'fallback', sourceNote: 'Open-Meteo недоступен — показаны справочные данные' };
  const metrics = { ...planet.metrics };
  metrics.tempMean = live.tempMean;
  if (live.pressureBar != null) {
    metrics.pressureBar = live.pressureBar;
    metrics.pressureNote = `среднее по ${live.sampled} опорным станциям`;
  }
  return {
    ...planet,
    metrics,
    live: {
      tempNow: live.tempMean,
      spread: { min: live.tempMin, max: live.tempMax },
      coldest: live.coldest,
      hottest: live.hottest,
      windMaxNow: live.windMax,
      sampled: live.sampled,
    },
    source: 'live',
    sourceNote: `Open-Meteo, ${live.sampled} опорных точек прямо сейчас`,
  };
}

/* ------------------------------------------------------------------ */

/** Сводка по всем планетам: живые данные там, где они есть, иначе заготовка. */
spaceRouter.get('/weather', async (_req, res) => {
  const [mars, solar, earth] = await Promise.all([fetchMars(), fetchSolar(), fetchEarth()]);

  const FALLBACK = loadFallback();
  const planets = FALLBACK.planets.map((p) => {
    const base = clone(p);
    if (base.id === 'mars') return mergeMars(base, mars);
    if (base.id === 'earth') return mergeEarth(base, earth);
    return {
      ...base,
      source: 'fallback',
      sourceNote: base.hasLiveEndpoint
        ? 'Живой источник недоступен — показаны справочные данные'
        : 'Публичного live-эндпоинта не существует — справочные данные NASA',
    };
  });

  const solarOut = solar
    ? { ...solar, summary: solar.summary ?? FALLBACK.solar.summary, source: 'live' }
    : { ...clone(FALLBACK.solar), source: 'fallback' };

  res.json({
    planets,
    solar: solarOut,
    sources: {
      mars: mars ? 'nasa-insight' : 'fallback',
      solar: solar ? 'nasa-donki' : 'fallback',
      earth: earth ? 'open-meteo' : 'fallback',
    },
    degraded: !mars && !solar && !earth,
    revision: FALLBACK.revision,
    fetchedAt: new Date().toISOString(),
  });
});

/** Одна планета по идентификатору — для прямой ссылки на карточку. */
spaceRouter.get('/planet/:id', async (req, res) => {
  const base = loadFallback().planets.find((p) => p.id === req.params.id);
  if (!base) return res.status(404).json({ error: 'Планета не найдена' });

  const planet = clone(base);
  if (planet.id === 'mars') return res.json({ planet: mergeMars(planet, await fetchMars()) });
  if (planet.id === 'earth') return res.json({ planet: mergeEarth(planet, await fetchEarth()) });
  res.json({
    planet: {
      ...planet,
      source: 'fallback',
      sourceNote: 'Справочные данные NASA',
    },
  });
});
