export interface User {
  id: number;
  email: string;
  name: string;
  avatarHue: number;
  units: 'metric' | 'imperial';
  theme: 'dark' | 'light';
  /** Пол для «Одеватора». null — не указан: показываем обе 3D-модели. */
  gender: 'male' | 'female' | null;
  home: { lat: number; lon: number; name: string } | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface GeoResult {
  id: number;
  name: string;
  country: string | null;
  countryCode?: string;
  admin1: string | null;
  lat: number;
  lon: number;
  timezone?: string;
  population?: number;
  elevation?: number;
}

export interface SavedLocation extends GeoResult {
  sortOrder: number;
  createdAt: string;
}

/**
 * Описание расширения поиска: сервер не нашёл данных в запрошенной точке и
 * отошёл к ближайшей, где они есть. null — данные пришли ровно по координатам.
 */
export interface GeoFallback {
  expanded: true;
  requested: { lat: number; lon: number };
  resolved: { lat: number; lon: number };
  distanceKm: number;
  reason: string;
}

/* ---------------- космическая погода ---------------- */

export interface PlanetComposition {
  name: string;
  formula: string;
  share: number;
}

export interface PlanetMetrics {
  tempMean: number;
  tempMin: number;
  tempMax: number;
  pressureBar: number;
  pressureNote: string;
  windMax: number | null;
  windNote: string;
  composition: PlanetComposition[];
}

export interface PlanetVisualConfig {
  deep: string;
  mid: string;
  rim: string;
  atmosphere: string;
  atmoStrength: number;
  bands: number;
  mottle: number;
  ring: { inner: number; outer: number; color: string; tilt: number } | null;
}

export interface Planet {
  id: string;
  name: string;
  kind: string;
  order: number;
  au: number;
  radiusKm: number;
  gravity: number;
  dayLength: string;
  yearLength: string;
  moons: number;
  hasLiveEndpoint: boolean;
  tagline: string;
  metrics: PlanetMetrics;
  highlights: string[];
  visual: PlanetVisualConfig;
  source: 'live' | 'fallback';
  sourceNote: string;
  live?: Record<string, any> | null;
}

export interface SolarActivity {
  summary: string | null;
  kpIndex: number | null;
  source: 'live' | 'fallback';
  flares: { id: string | null; classType: string | null; beginTime: string | null; peakTime: string | null; sourceLocation: string | null }[];
  storms: { id: string | null; startTime: string | null; maxKp: number | null }[];
}

export interface SpaceWeather {
  planets: Planet[];
  solar: SolarActivity;
  sources: { mars: string; solar: string; earth: string };
  degraded: boolean;
  revision: string;
  fetchedAt: string;
}

export interface ForecastBundle {
  forecast: {
    latitude: number;
    longitude: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    utc_offset_seconds: number;
    current: Record<string, number | string>;
    current_units: Record<string, string>;
    hourly: Record<string, (number | null)[]> & { time: string[] };
    hourly_units: Record<string, string>;
    daily: Record<string, (number | null)[]> & { time: string[]; sunrise: string[]; sunset: string[] };
    daily_units: Record<string, string>;
  };
  air: {
    current: Record<string, number> | null;
    hourly?: Record<string, (number | null)[]> & { time: string[] };
  } | null;
  units: 'metric' | 'imperial';
  fallback: GeoFallback | null;
  fetchedAt: string;
}

export interface GridCell {
  lat: number; lon: number;
  temp: number | null; wind: number | null; dir: number | null;
  precip: number | null; clouds: number | null;
  humidity: number | null; pressure: number | null; code: number | null;
}

export interface GridResponse {
  bbox: { north: number; south: number; east: number; west: number };
  cols: number; rows: number;
  cells: GridCell[];
}

export type ExtremeKind = 'hot' | 'cold' | 'wind';

export interface ExtremePoint {
  name: string;
  country: string;
  lat: number;
  lon: number;
  blurb: string | null;
  isGrid: boolean;
  temp: number;
  feelsLike: number | null;
  humidity: number | null;
  wind: number | null;
  gusts: number | null;
  windDir: number | null;
  code: number | null;
  isDay: number;
  precip: number | null;
  localTime: string | null;
  timezone: string | null;
}

export interface ExtremesResponse {
  kind: ExtremeKind;
  units: 'metric' | 'imperial';
  best: ExtremePoint;
  runnersUp: ExtremePoint[];
  scanned: number;
  requested: number;
  note: string;
  fetchedAt: string;
}

export interface RadarFrame { time: number; path: string; url: string }
export interface RadarResponse {
  host: string;
  generated: number;
  radar: { past: RadarFrame[]; nowcast: RadarFrame[] };
  satellite: { infrared: RadarFrame[] };
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'aeris_token';
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(data.error ?? `Ошибка ${res.status}`, res.status);
  return data as T;
}

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

export const api = {
  health: () => request<{ status: string; uptimeSec: number }>('/health'),

  register: (body: { name: string; email: string; password: string }) =>
    request<{ user: User; token: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST', body: JSON.stringify(body),
    }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User }>('/auth/me'),

  updateMe: (body: Partial<Pick<User, 'name' | 'units' | 'theme' | 'avatarHue' | 'gender'>> & {
    home?: { lat: number; lon: number; name: string } | null;
  }) => request<{ user: User }>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),

  activity: () =>
    request<{ activity: { kind: string; detail: string | null; created_at: string }[] }>('/auth/activity'),

  geocode: (q: string) => request<{ results: GeoResult[] }>(`/weather/geocode?${query({ q })}`),

  reverse: (lat: number, lon: number) =>
    request<{
      name: string; country: string | null; admin1: string | null;
      lat: number; lon: number; fallback: GeoFallback | null;
    }>(`/weather/reverse?${query({ lat, lon })}`),

  forecast: (lat: number, lon: number, units: string, days = 14) =>
    request<ForecastBundle>(`/weather/forecast?${query({ lat, lon, units, days })}`),

  bulk: (points: { lat: number; lon: number }[], units: string) =>
    request<{ points: any[] }>(
      `/weather/bulk?${query({ points: points.map((p) => `${p.lat},${p.lon}`).join(';'), units })}`
    ),

  grid: (b: { north: number; south: number; east: number; west: number },
         opts: { cols?: number; rows?: number; units?: string } = {}) =>
    request<GridResponse>(`/weather/grid?${query({ ...b, ...opts })}`),

  radar: () => request<RadarResponse>('/weather/radar'),

  extremes: (kind: ExtremeKind, units: string) =>
    request<ExtremesResponse>(`/weather/extremes?${query({ kind, units })}`),

  spaceWeather: () => request<SpaceWeather>('/space/weather'),

  planet: (id: string) => request<{ planet: Planet }>(`/space/planet/${encodeURIComponent(id)}`),

  locations: () => request<{ locations: SavedLocation[] }>('/locations'),

  addLocation: (body: {
    name: string; country?: string | null; admin1?: string | null;
    lat: number; lon: number; timezone?: string | null;
  }) => request<{ location: SavedLocation }>('/locations', {
    method: 'POST', body: JSON.stringify(body),
  }),

  removeLocation: (id: number) =>
    request<{ ok: boolean }>(`/locations/${id}`, { method: 'DELETE' }),
};
