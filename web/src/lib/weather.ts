/** WMO weather-code vocabulary + visual language shared by every surface of the app. */

export type Sky =
  | 'clear' | 'partly' | 'cloudy' | 'fog'
  | 'drizzle' | 'rain' | 'snow' | 'thunder';

/**
 * Идентификатор погодного явления.
 *
 * Раньше здесь лежали готовые русские подписи, из-за чего сводки оставались
 * русскими при любом выбранном языке. Теперь модуль хранит только смысл, а
 * текст берётся из словаря по ключам `wmo.<id>` и `wmo.<id>Short`.
 */
export type WeatherCodeId =
  | 'clear' | 'mainly' | 'partly' | 'overcast' | 'fog' | 'rime'
  | 'drizzle' | 'drizzleHeavy' | 'freezing'
  | 'rainLight' | 'rain' | 'rainHeavy' | 'showers' | 'showersHeavy'
  | 'snowLight' | 'snow' | 'snowHeavy' | 'snowGrains'
  | 'snowShowers' | 'snowShowersHeavy'
  | 'thunder' | 'hail';

export interface CodeInfo {
  id: WeatherCodeId;
  sky: Sky;
  /** gradient stops for cards / hero backdrops */
  gradient: [string, string];
  accent: string;
}

/** Ключи словаря для полной и краткой подписи. */
export const codeLabelKey = (info: CodeInfo) => `wmo.${info.id}`;
export const codeShortKey = (info: CodeInfo) => `wmo.${info.id}Short`;

const C = (
  id: WeatherCodeId, sky: Sky, gradient: [string, string], accent: string
): CodeInfo => ({ id, sky, gradient, accent });

const CLEAR = C('clear', 'clear', ['#1d5cff', '#7df2ff'], '#7df2ff');
const MAINLY = C('mainly', 'partly', ['#2a5fd0', '#8fd8ff'], '#9fe4ff');
const PARTLY = C('partly', 'partly', ['#31456f', '#8ba6d6'], '#b9cdf0');
const OVERCAST = C('overcast', 'cloudy', ['#2b3450', '#6a7a9c'], '#c3ceE4');
const FOG = C('fog', 'fog', ['#3a4258', '#8e97a8'], '#d3d9e6');
const DRIZZLE = C('drizzle', 'drizzle', ['#25405f', '#5f9ec0'], '#8fd0e8');
const RAIN = C('rain', 'rain', ['#1b2d47', '#3f7fa8'], '#63b3ea');
const HEAVY_RAIN = C('rainHeavy', 'rain', ['#141f33', '#2f5f85'], '#4aa3e0');
const FREEZING = C('freezing', 'rain', ['#243b52', '#79b8d4'], '#a8e2f5');
const SNOW = C('snow', 'snow', ['#3d4a68', '#cfe0f5'], '#e6f1ff');
const SHOWERS = C('showers', 'rain', ['#182a44', '#3c7ba6'], '#5cb0e8');
const THUNDER = C('thunder', 'thunder', ['#221b3f', '#5b4a9e'], '#c4a6ff');
const HAIL = C('hail', 'thunder', ['#1b1733', '#4b3f8c'], '#d7c4ff');

export const WMO: Record<number, CodeInfo> = {
  0: CLEAR,
  1: MAINLY, 2: PARTLY, 3: OVERCAST,
  45: FOG, 48: C('rime', 'fog', ['#39445c', '#9aa6bb'], '#dbe3f0'),
  51: DRIZZLE, 53: DRIZZLE, 55: C('drizzleHeavy', 'drizzle', ['#20374f', '#5793b5'], '#8fd0e8'),
  56: FREEZING, 57: FREEZING,
  61: C('rainLight', 'rain', ['#1e3350', '#4a89b3'], '#6dbcf0'),
  63: RAIN, 65: HEAVY_RAIN,
  66: FREEZING, 67: FREEZING,
  71: C('snowLight', 'snow', ['#414d6b', '#dbe8fa'], '#eef5ff'),
  73: SNOW, 75: C('snowHeavy', 'snow', ['#333e5c', '#c2d6f0'], '#e6f1ff'),
  77: C('snowGrains', 'snow', ['#3b4765', '#d2e2f5'], '#eaf3ff'),
  80: SHOWERS, 81: SHOWERS, 82: C('showersHeavy', 'rain', ['#101a2c', '#2a5c85'], '#3f9ad9'),
  85: C('snowShowers', 'snow', ['#374362', '#c8daf2'], '#e9f2ff'),
  86: C('snowShowersHeavy', 'snow', ['#2e3a58', '#b8cdec'], '#e2eeff'),
  95: THUNDER, 96: HAIL, 99: HAIL,
};

export const codeInfo = (code: number | null | undefined): CodeInfo =>
  WMO[code ?? 0] ?? OVERCAST;

/** Emoji fallback used in compact rows where an SVG icon would be noise. */
export const codeEmoji = (code: number | null | undefined, isDay = true): string => {
  const c = code ?? 0;
  if (c === 0) return isDay ? '☀️' : '🌙';
  if (c === 1) return isDay ? '🌤️' : '🌙';
  if (c === 2) return isDay ? '⛅' : '☁️';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if (c >= 51 && c <= 57) return '🌦️';
  if (c >= 61 && c <= 67) return '🌧️';
  if (c >= 71 && c <= 77) return '❄️';
  if (c >= 80 && c <= 82) return '🌧️';
  if (c === 85 || c === 86) return '🌨️';
  if (c >= 95) return '⛈️';
  return '☁️';
};

/** Continuous temperature -> colour ramp, shared by the map, charts and badges. */
export function tempColor(t: number | null | undefined, units: 'metric' | 'imperial' = 'metric'): string {
  if (t == null || Number.isNaN(t)) return 'rgba(148,163,196,0.5)';
  const c = units === 'imperial' ? ((t - 32) * 5) / 9 : t;
  const stops: [number, [number, number, number]][] = [
    [-40, [86, 20, 140]],
    [-25, [58, 46, 190]],
    [-12, [40, 110, 220]],
    [-2, [56, 178, 232]],
    [6, [46, 205, 190]],
    [14, [120, 214, 120]],
    [20, [232, 214, 92]],
    [26, [246, 160, 60]],
    [32, [238, 92, 62]],
    [40, [200, 36, 76]],
    [50, [150, 12, 90]],
  ];
  if (c <= stops[0][0]) return `rgb(${stops[0][1].join(',')})`;
  const last = stops[stops.length - 1];
  if (c >= last[0]) return `rgb(${last[1].join(',')})`;

  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (c >= t0 && c <= t1) {
      const k = (c - t0) / (t1 - t0);
      const mix = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${mix.join(',')})`;
    }
  }
  return 'rgb(148,163,196)';
}

export const windColor = (speed: number | null | undefined): string => {
  const v = speed ?? 0;
  if (v < 8) return '#7df2ff';
  if (v < 18) return '#4ade80';
  if (v < 30) return '#fbbf24';
  if (v < 50) return '#fb923c';
  if (v < 75) return '#f43f5e';
  return '#e879f9';
};

export const windLabel = (kmh: number): string => {
  if (kmh < 1) return 'Штиль';
  if (kmh < 6) return 'Тихий';
  if (kmh < 12) return 'Лёгкий';
  if (kmh < 20) return 'Слабый';
  if (kmh < 29) return 'Умеренный';
  if (kmh < 39) return 'Свежий';
  if (kmh < 50) return 'Сильный';
  if (kmh < 62) return 'Крепкий';
  if (kmh < 75) return 'Очень крепкий';
  if (kmh < 89) return 'Шторм';
  if (kmh < 103) return 'Сильный шторм';
  if (kmh < 118) return 'Жестокий шторм';
  return 'Ураган';
};

const DIRS = ['С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ',
              'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'];
export const windDir = (deg: number | null | undefined): string =>
  deg == null ? '—' : DIRS[Math.round((deg % 360) / 22.5) % 16];

export const uvInfo = (uv: number | null | undefined) => {
  const v = uv ?? 0;
  if (v < 3) return { label: 'Низкий', color: '#4ade80', pct: (v / 11) * 100 };
  if (v < 6) return { label: 'Умеренный', color: '#fbbf24', pct: (v / 11) * 100 };
  if (v < 8) return { label: 'Высокий', color: '#fb923c', pct: (v / 11) * 100 };
  if (v < 11) return { label: 'Очень высокий', color: '#f43f5e', pct: (v / 11) * 100 };
  return { label: 'Экстремальный', color: '#a855f7', pct: 100 };
};

export const aqiInfo = (aqi: number | null | undefined) => {
  const v = aqi ?? 0;
  if (v <= 20) return { label: 'Отличный', color: '#4ade80', pct: (v / 100) * 100 };
  if (v <= 40) return { label: 'Хороший', color: '#a3e635', pct: (v / 100) * 100 };
  if (v <= 60) return { label: 'Средний', color: '#fbbf24', pct: (v / 100) * 100 };
  if (v <= 80) return { label: 'Плохой', color: '#fb923c', pct: (v / 100) * 100 };
  if (v <= 100) return { label: 'Очень плохой', color: '#f43f5e', pct: (v / 100) * 100 };
  return { label: 'Опасный', color: '#a855f7', pct: 100 };
};

export const pressureTrend = (series: (number | null)[], idx: number): 'up' | 'down' | 'flat' => {
  const now = series[idx];
  const before = series[Math.max(0, idx - 3)];
  if (now == null || before == null) return 'flat';
  const d = now - before;
  if (d > 1) return 'up';
  if (d < -1) return 'down';
  return 'flat';
};

/** Human comfort read-out combining temperature, humidity and wind. */
export function comfortIndex(temp: number, humidity: number, wind: number): {
  score: number; label: string; color: string;
} {
  const tempPenalty = Math.abs(temp - 21) * 3.2;
  const humPenalty = Math.abs(humidity - 50) * 0.55;
  const windPenalty = Math.max(0, wind - 15) * 0.9;
  const score = Math.max(0, Math.min(100, Math.round(100 - tempPenalty - humPenalty - windPenalty)));
  if (score >= 80) return { score, label: 'Идеально', color: '#4ade80' };
  if (score >= 60) return { score, label: 'Комфортно', color: '#a3e635' };
  if (score >= 40) return { score, label: 'Терпимо', color: '#fbbf24' };
  if (score >= 20) return { score, label: 'Некомфортно', color: '#fb923c' };
  return { score, label: 'Экстремально', color: '#f43f5e' };
}
