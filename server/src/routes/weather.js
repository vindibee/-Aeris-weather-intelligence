import { Router } from 'express';
import { z } from 'zod';
import { fetchJson, qs, UpstreamError } from '../lib/upstream.js';
import { queryVariants } from '../lib/translit.js';
import { findNearestWithData, fallbackInfo } from '../lib/nearest.js';
import { stationsFor } from '../lib/stations.js';

export const weatherRouter = Router();

const OM = 'https://api.open-meteo.com/v1/forecast';
const AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const REV = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const RADAR = 'https://api.rainviewer.com/public/weather-maps.json';

const HOURLY = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m',
  'precipitation', 'precipitation_probability', 'rain', 'showers', 'snowfall',
  'weather_code', 'cloud_cover', 'pressure_msl', 'surface_pressure',
  'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'uv_index', 'is_day', 'cape',
];

const DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'apparent_temperature_max', 'apparent_temperature_min',
  'sunrise', 'sunset', 'daylight_duration', 'uv_index_max',
  'precipitation_sum', 'rain_sum', 'snowfall_sum', 'precipitation_hours',
  'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
];

const CURRENT = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'is_day',
  'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover',
  'pressure_msl', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
];

const coord = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  units: z.enum(['metric', 'imperial']).default('metric'),
  days: z.coerce.number().int().min(1).max(16).default(14),
});

const unitParams = (units) =>
  units === 'imperial'
    ? { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch' }
    : { temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm' };

/* ------------------------------------------------------------------ */
/*  Fallback по пустым точкам                                          */
/* ------------------------------------------------------------------ */

/** Есть ли в ответе провайдера пригодные текущие наблюдения. */
const hasCurrent = (d) => Number.isFinite(d?.current?.temperature_2m);

/**
 * Дешёвый зонд: тянем только температуру, чтобы понять, есть ли вообще данные
 * по точке. Полный набор параметров запрашиваем уже по найденным координатам.
 */
async function probeCurrent(point, units) {
  const d = await fetchJson(`${OM}?${qs({
    latitude: point.lat.toFixed(4), longitude: point.lon.toFixed(4),
    current: ['temperature_2m'], timezone: 'GMT', ...unitParams(units),
  })}`, { ttl: 12 * 60_000, retries: 1, timeout: 9000 });
  return hasCurrent(d) ? d : null;
}

/**
 * Ближайшая точка с наблюдениями. Возвращает координаты, до которых пришлось
 * расшириться, и описание для фронта — либо null, если данных нет и рядом.
 */
async function resolveNearestPoint(lat, lon, units) {
  const found = await findNearestWithData(lat, lon, (p) => probeCurrent(p, units));
  if (!found) return null;
  return { point: found.point, fallback: fallbackInfo(found, { lat, lon }) };
}

/** Full bundle for one point: current + hourly + daily + air quality. */
weatherRouter.get('/forecast', async (req, res, next) => {
  const parsed = coord.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные координаты' });
  const { lat, lon, units, days } = parsed.data;

  const bundle = async (point) => {
    const forecastUrl = `${OM}?${qs({
      latitude: point.lat.toFixed(4), longitude: point.lon.toFixed(4),
      current: CURRENT, hourly: HOURLY, daily: DAILY,
      forecast_days: days, past_days: 2, timezone: 'auto',
      models: 'best_match', ...unitParams(units),
    })}`;

    const airUrl = `${AQ}?${qs({
      latitude: point.lat.toFixed(4), longitude: point.lon.toFixed(4),
      current: ['european_aqi', 'us_aqi', 'pm10', 'pm2_5', 'carbon_monoxide',
                'nitrogen_dioxide', 'sulphur_dioxide', 'ozone', 'dust', 'uv_index'],
      hourly: ['european_aqi', 'pm2_5', 'pm10'],
      forecast_days: 3, timezone: 'auto',
    })}`;

    // Качество воздуха — приятное дополнение: оно не должно ронять прогноз.
    return Promise.all([
      fetchJson(forecastUrl, { ttl: 10 * 60_000 }),
      fetchJson(airUrl, { ttl: 20 * 60_000 }).catch(() => null),
    ]);
  };

  try {
    let [forecast, air] = await bundle({ lat, lon });
    let fallback = null;

    // Провайдер вернул пустоту по точке — расширяем радиус до ближайшего места
    // с наблюдениями, вместо того чтобы показывать пользователю прочерки.
    if (!hasCurrent(forecast)) {
      const nearest = await resolveNearestPoint(lat, lon, units);
      if (!nearest) {
        return res.status(404).json({
          error: 'Нет метеоданных ни в этой точке, ни в радиусе 800 км',
        });
      }
      fallback = nearest.fallback;
      [forecast, air] = await bundle(nearest.point);
    }

    res.json({ forecast, air, units, fallback, fetchedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

/** City search (autocomplete). Cyrillic input is transliterated before it goes upstream. */
weatherRouter.get('/geocode', async (req, res, next) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ results: [] });

  const shape = (r) => ({
    id: r.id, name: r.name, country: r.country, countryCode: r.country_code,
    admin1: r.admin1, lat: r.latitude, lon: r.longitude,
    timezone: r.timezone, population: r.population, elevation: r.elevation,
  });

  try {
    for (const variant of queryVariants(q)) {
      const data = await fetchJson(
        `${GEO}?${qs({ name: variant, count: 8, language: req.query.lang ?? 'ru', format: 'json' })}`,
        { ttl: 24 * 60 * 60_000 }
      ).catch(() => null);
      const results = data?.results ?? [];
      if (results.length) {
        // Upstream ranking is name-first; users almost always want the big city.
        const ranked = results.map(shape).sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
        return res.json({ results: ranked, query: variant });
      }
    }
    res.json({ results: [], query: q });
  } catch (err) { next(err); }
});

/**
 * Обратный геокодинг — для геолокации браузера и кликов по карте.
 *
 * Над океаном и в необжитых районах провайдер отдаёт пустые поля. В этом случае
 * расширяем радиус кольцами, пока не найдём ближайший named-объект (берег,
 * посёлок, административный центр), и сообщаем, насколько отошли.
 */
weatherRouter.get('/reverse', async (req, res) => {
  const parsed = coord.pick({ lat: true, lon: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректные координаты' });
  const { lat, lon } = parsed.data;

  const probe = async (p) => {
    const d = await fetchJson(
      `${REV}?${qs({ latitude: p.lat, longitude: p.lon, localityLanguage: 'ru' })}`,
      { ttl: 24 * 60 * 60_000, retries: 1, timeout: 9000 }
    );
    const name = d?.city || d?.locality || d?.principalSubdivision;
    if (!name) return null;
    return { name, country: d.countryName ?? null, admin1: d.principalSubdivision ?? null };
  };

  try {
    const direct = await probe({ lat, lon }).catch(() => null);
    if (direct) return res.json({ ...direct, lat, lon, fallback: null });

    const found = await findNearestWithData(lat, lon, probe);
    if (found) {
      return res.json({
        ...found.data,
        lat: found.point.lat,
        lon: found.point.lon,
        fallback: fallbackInfo(found, { lat, lon }),
      });
    }
    res.json({
      name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      country: null, admin1: null, lat, lon, fallback: null,
    });
  } catch {
    res.json({
      name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      country: null, admin1: null, lat, lon, fallback: null,
    });
  }
});

/** Compact current conditions for many saved points in a single upstream call. */
weatherRouter.get('/bulk', async (req, res, next) => {
  const raw = String(req.query.points ?? '').trim();
  if (!raw) return res.json({ points: [] });

  const pts = raw.split(';').map((p) => p.split(',').map(Number))
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)).slice(0, 25);
  if (!pts.length) return res.json({ points: [] });

  const units = req.query.units === 'imperial' ? 'imperial' : 'metric';
  try {
    const data = await fetchJson(`${OM}?${qs({
      latitude: pts.map((p) => p[0].toFixed(4)),
      longitude: pts.map((p) => p[1].toFixed(4)),
      current: ['temperature_2m', 'weather_code', 'is_day', 'wind_speed_10m',
                'relative_humidity_2m', 'apparent_temperature'],
      daily: ['temperature_2m_max', 'temperature_2m_min', 'weather_code', 'precipitation_probability_max'],
      forecast_days: 3, timezone: 'auto', ...unitParams(units),
    })}`, { ttl: 10 * 60_000 });

    const arr = Array.isArray(data) ? data : [data];
    const points = arr.map((d, i) => ({ lat: pts[i][0], lon: pts[i][1], ...d, fallback: null }));

    // Точки, по которым провайдер промолчал, дотягиваем расширяющимся поиском.
    // Ограничиваем количество: 25 пустых точек по 6 колец каждая — это уже
    // не «дозапрос», а обстрел провайдера.
    const empty = points.filter((p) => !hasCurrent(p)).slice(0, 6);
    await Promise.all(empty.map(async (p) => {
      const nearest = await resolveNearestPoint(p.lat, p.lon, units).catch(() => null);
      if (!nearest) return;
      const filled = await fetchJson(`${OM}?${qs({
        latitude: nearest.point.lat.toFixed(4), longitude: nearest.point.lon.toFixed(4),
        current: ['temperature_2m', 'weather_code', 'is_day', 'wind_speed_10m',
                  'relative_humidity_2m', 'apparent_temperature'],
        daily: ['temperature_2m_max', 'temperature_2m_min', 'weather_code', 'precipitation_probability_max'],
        forecast_days: 3, timezone: 'auto', ...unitParams(units),
      })}`, { ttl: 10 * 60_000 }).catch(() => null);
      if (!hasCurrent(filled)) return;
      Object.assign(p, filled, { lat: p.lat, lon: p.lon, fallback: nearest.fallback });
    }));

    res.json({ points });
  } catch (err) { next(err); }
});

/** Sampled grid over a bbox - powers the temperature / wind / cloud layers on the map. */
weatherRouter.get('/grid', async (req, res, next) => {
  const schema = z.object({
    north: z.coerce.number().min(-90).max(90),
    south: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
    west: z.coerce.number().min(-180).max(180),
    cols: z.coerce.number().int().min(4).max(14).default(11),
    rows: z.coerce.number().int().min(3).max(12).default(8),
    units: z.enum(['metric', 'imperial']).default('metric'),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный bbox' });
  let { north, south, east, west, cols, rows, units } = parsed.data;

  if (north < south) [north, south] = [south, north];
  if (east < west) [east, west] = [west, east];
  // Snap the bbox so a small pan reuses the same cache key.
  const snap = (v, s) => Math.round(v / s) * s;
  const step = 0.5;
  north = Math.min(85, snap(north, step)); south = Math.max(-85, snap(south, step));
  east = snap(east, step); west = snap(west, step);
  if (north - south < 0.5) north = south + 0.5;
  if (east - west < 0.5) east = west + 0.5;

  const lats = [], lons = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      lats.push(+(south + ((north - south) * (r + 0.5)) / rows).toFixed(3));
      lons.push(+(west + ((east - west) * (c + 0.5)) / cols).toFixed(3));
    }
  }

  try {
    const data = await fetchJson(`${OM}?${qs({
      latitude: lats, longitude: lons,
      current: ['temperature_2m', 'wind_speed_10m', 'wind_direction_10m',
                'precipitation', 'cloud_cover', 'relative_humidity_2m',
                'pressure_msl', 'weather_code'],
      timezone: 'GMT', ...unitParams(units),
    })}`, { ttl: 12 * 60_000 });

    const arr = Array.isArray(data) ? data : [data];
    res.json({
      bbox: { north, south, east, west }, cols, rows, units,
      cells: arr.map((d, i) => ({
        lat: lats[i], lon: lons[i],
        temp: d.current?.temperature_2m ?? null,
        wind: d.current?.wind_speed_10m ?? null,
        dir: d.current?.wind_direction_10m ?? null,
        precip: d.current?.precipitation ?? null,
        clouds: d.current?.cloud_cover ?? null,
        humidity: d.current?.relative_humidity_2m ?? null,
        pressure: d.current?.pressure_msl ?? null,
        code: d.current?.weather_code ?? null,
      })),
    });
  } catch (err) { next(err); }
});

/**
 * Мировые экстремумы: самая жаркая, холодная и ветреная точка прямо сейчас.
 *
 * Оговорка, которую видно и в ответе: это не поиск глобального максимума по
 * всей планете — бесплатного API для такого нет. Мы опрашиваем опорную сеть из
 * ~110 точек (все места, регулярно ставящие рекорды, плюс равномерная сетка)
 * и выбираем экстремум среди них.
 */
weatherRouter.get('/extremes', async (req, res, next) => {
  const schema = z.object({
    kind: z.enum(['hot', 'cold', 'wind']).default('hot'),
    units: z.enum(['metric', 'imperial']).default('metric'),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный вид экстремума' });
  const { kind, units } = parsed.data;

  const stations = stationsFor(kind);

  try {
    // Длинный URL с сотней координат провайдер принимает, но режем на части:
    // так один медленный кусок не задерживает остальные и легче кэшируется.
    const CHUNK = 40;
    const chunks = [];
    for (let i = 0; i < stations.length; i += CHUNK) chunks.push(stations.slice(i, i + CHUNK));

    const responses = await Promise.all(chunks.map((chunk) =>
      fetchJson(`${OM}?${qs({
        latitude: chunk.map((s) => s.lat.toFixed(4)),
        longitude: chunk.map((s) => s.lon.toFixed(4)),
        current: ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
                  'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m',
                  'weather_code', 'is_day', 'precipitation'],
        timezone: 'auto', ...unitParams(units),
      })}`, { ttl: 15 * 60_000, retries: 1, timeout: 12_000 }).catch(() => null)
    ));

    const points = [];
    responses.forEach((data, ci) => {
      if (!data) return;
      const arr = Array.isArray(data) ? data : [data];
      arr.forEach((d, i) => {
        const station = chunks[ci][i];
        if (!station || !d?.current) return;
        const c = d.current;
        if (!Number.isFinite(c.temperature_2m)) return;
        points.push({
          name: station.name,
          country: station.country,
          lat: station.lat,
          lon: station.lon,
          blurb: station.blurb ?? null,
          isGrid: station.tags?.includes('grid') ?? false,
          temp: c.temperature_2m,
          feelsLike: c.apparent_temperature ?? null,
          humidity: c.relative_humidity_2m ?? null,
          wind: c.wind_speed_10m ?? null,
          gusts: c.wind_gusts_10m ?? null,
          windDir: c.wind_direction_10m ?? null,
          code: c.weather_code ?? null,
          isDay: c.is_day ?? 1,
          precip: c.precipitation ?? null,
          localTime: d.current?.time ?? null,
          timezone: d.timezone ?? null,
        });
      });
    });

    if (!points.length) {
      return res.status(503).json({ error: 'Провайдер не ответил ни по одной опорной точке' });
    }

    const ranked = [...points].sort((a, b) => {
      if (kind === 'hot') return b.temp - a.temp;
      if (kind === 'cold') return a.temp - b.temp;
      // для ветра сравниваем по порывам, а при их отсутствии — по средней скорости
      return (b.gusts ?? b.wind ?? 0) - (a.gusts ?? a.wind ?? 0);
    });

    res.json({
      kind,
      units,
      best: ranked[0],
      runnersUp: ranked.slice(1, 5),
      scanned: points.length,
      requested: stations.length,
      note: 'Экстремум найден среди опорной сети станций, а не по всей поверхности планеты',
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

/** RainViewer radar + satellite frame index (free, no key). */
weatherRouter.get('/radar', async (_req, res, next) => {
  try {
    const d = await fetchJson(RADAR, { ttl: 4 * 60_000 });
    const map = (f) => ({ time: f.time, path: f.path, url: `${d.host}${f.path}` });
    res.json({
      host: d.host,
      generated: d.generated,
      radar: { past: (d.radar?.past ?? []).map(map), nowcast: (d.radar?.nowcast ?? []).map(map) },
      satellite: { infrared: (d.satellite?.infrared ?? []).map(map) },
    });
  } catch (err) { next(err); }
});

weatherRouter.use((err, _req, res, _next) => {
  const status = err instanceof UpstreamError ? err.status : 500;
  res.status(status).json({ error: err.message ?? 'Ошибка сервиса погоды' });
});
