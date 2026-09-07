/**
 * Fallback-поиск с расширяющимся радиусом.
 *
 * Провайдер может вернуть «нет информации» по точке: середина океана, полярная
 * шапка, дыра в сетке модели, отсутствие населённого пункта для обратного
 * геокодинга. Вместо того чтобы отдавать пустоту, обходим кольца вокруг точки,
 * пока не найдём ближайшее место с данными, и честно сообщаем, насколько
 * пришлось отойти.
 */

const EARTH_R_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Расстояние по большому кругу, км. */
export function haversineKm(aLat, aLon, bLat, bLon) {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Точка на расстоянии distanceKm по азимуту bearingDeg от исходной. */
export function offsetPoint(lat, lon, distanceKm, bearingDeg) {
  const d = distanceKm / EARTH_R_KM;
  const brg = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  // широту зажимаем, долготу заворачиваем в [-180, 180]
  const outLat = Math.max(-90, Math.min(90, toDeg(lat2)));
  let outLon = toDeg(lon2);
  outLon = ((outLon + 540) % 360) - 180;
  return { lat: +outLat.toFixed(4), lon: +outLon.toFixed(4) };
}

/** Кольца по умолчанию, км. Первый «ноль» — сама исходная точка. */
const DEFAULT_RINGS = [0, 25, 60, 150, 350, 800];
const DEFAULT_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Ищет ближайшую точку, для которой probe вернул непустой результат.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {(p: {lat: number, lon: number}) => Promise<any>} probe
 *        Должен вернуть данные либо null/undefined, если информации нет.
 *        Исключения внутри probe считаются как «нет данных».
 * @param {{rings?: number[], bearings?: number[]}} [opts]
 * @returns {Promise<{data: any, point: {lat: number, lon: number}, distanceKm: number, expanded: boolean, ringsTried: number} | null>}
 */
export async function findNearestWithData(lat, lon, probe, opts = {}) {
  const rings = opts.rings ?? DEFAULT_RINGS;
  const bearings = opts.bearings ?? DEFAULT_BEARINGS;

  for (let r = 0; r < rings.length; r++) {
    const radius = rings[r];
    const points =
      radius === 0
        ? [{ lat: +lat.toFixed(4), lon: +lon.toFixed(4) }]
        : bearings.map((b) => offsetPoint(lat, lon, radius, b));

    // Кольцо опрашиваем целиком и параллельно: провайдер всё равно кэшируется,
    // а так на одно кольцо уходит один сетевой раунд, а не восемь.
    const probed = await Promise.all(
      points.map(async (p) => {
        try {
          const data = await probe(p);
          return data == null ? null : { data, point: p };
        } catch {
          return null;
        }
      })
    );

    const found = probed.filter(Boolean);
    if (!found.length) continue;

    // В кольце может ответить несколько точек — берём геометрически ближайшую.
    found.sort(
      (a, b) =>
        haversineKm(lat, lon, a.point.lat, a.point.lon) -
        haversineKm(lat, lon, b.point.lat, b.point.lon)
    );
    const best = found[0];
    const distanceKm = haversineKm(lat, lon, best.point.lat, best.point.lon);

    return {
      data: best.data,
      point: best.point,
      distanceKm: Math.round(distanceKm),
      expanded: radius > 0,
      ringsTried: r + 1,
    };
  }

  return null;
}

/**
 * Описание расширения поиска для ответа API. null, если данные нашлись
 * ровно в запрошенной точке — фронту тогда нечего показывать.
 */
export function fallbackInfo(result, requested) {
  if (!result || !result.expanded) return null;
  return {
    expanded: true,
    requested: { lat: requested.lat, lon: requested.lon },
    resolved: result.point,
    distanceKm: result.distanceKm,
    reason: 'В запрошенной точке данных нет — взяли ближайшую точку с наблюдениями',
  };
}
