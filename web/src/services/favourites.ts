/**
 * Репозиторий избранных локаций.
 *
 * Слой доступа к данным: UI и хуки не знают, где лежит список — на сервере у
 * авторизованного пользователя или в localStorage у гостя. Обе реализации
 * закрыты одним интерфейсом, поэтому вызывающий код одинаков (принцип
 * подстановки Лисков и инверсии зависимостей).
 */

import { api, type SavedLocation } from '../lib/api';

export interface FavouriteCity {
  name: string;
  country?: string | null;
  admin1?: string | null;
  lat: number;
  lon: number;
  timezone?: string | null;
}

export interface FavouriteRecord extends FavouriteCity {
  /** Числовой id для серверных записей, строковый ключ для гостевых. */
  id: number | string;
  createdAt: string;
}

export interface FavouritesRepository {
  list(): Promise<FavouriteRecord[]>;
  add(city: FavouriteCity): Promise<FavouriteRecord>;
  remove(id: number | string): Promise<void>;
}

/**
 * Одна точка на карте может прийти из разных источников (поиск, глобус, клик
 * по карте) с расхождением в сотые доли градуса. Считаем такие точки одной и
 * той же: 0.05° — это около 5 км, город целиком.
 */
export const SAME_PLACE_EPS = 0.05;

export const isSamePlace = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) => Math.abs(a.lat - b.lat) < SAME_PLACE_EPS && Math.abs(a.lon - b.lon) < SAME_PLACE_EPS;

export const findFavourite = (
  list: FavouriteRecord[] | undefined,
  point: { lat: number; lon: number }
) => list?.find((f) => isSamePlace(f, point));

/* ------------------------------------------------------------------ */
/*  Серверная реализация — для авторизованных                          */
/* ------------------------------------------------------------------ */

const fromSaved = (l: SavedLocation): FavouriteRecord => ({
  id: l.id,
  name: l.name,
  country: l.country,
  admin1: l.admin1,
  lat: l.lat,
  lon: l.lon,
  timezone: l.timezone ?? null,
  createdAt: l.createdAt,
});

export const serverFavourites: FavouritesRepository = {
  async list() {
    const { locations } = await api.locations();
    return locations.map(fromSaved);
  },
  async add(city) {
    const { location } = await api.addLocation({
      name: city.name,
      country: city.country ?? null,
      admin1: city.admin1 ?? null,
      lat: city.lat,
      lon: city.lon,
      timezone: city.timezone ?? null,
    });
    return fromSaved(location);
  },
  async remove(id) {
    await api.removeLocation(Number(id));
  },
};

/* ------------------------------------------------------------------ */
/*  Гостевая реализация — localStorage                                 */
/* ------------------------------------------------------------------ */

const GUEST_KEY = 'aeris_favourites_guest';

function readGuest(): FavouriteRecord[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // повреждённый localStorage не должен ронять раздел
    return [];
  }
}

const writeGuest = (list: FavouriteRecord[]) => {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(list));
  } catch {
    // приватный режим или переполненное хранилище — молча работаем в памяти
  }
};

export const guestFavourites: FavouritesRepository = {
  async list() {
    return readGuest();
  },
  async add(city) {
    const list = readGuest();
    const existing = findFavourite(list, city);
    if (existing) return existing;

    const record: FavouriteRecord = {
      ...city,
      id: `guest:${city.lat.toFixed(4)}:${city.lon.toFixed(4)}`,
      createdAt: new Date().toISOString(),
    };
    writeGuest([...list, record]);
    return record;
  },
  async remove(id) {
    writeGuest(readGuest().filter((f) => f.id !== id));
  },
};

/** Гостевой список — чтобы перенести его в аккаунт после входа. */
export const takeGuestFavourites = (): FavouriteRecord[] => {
  const list = readGuest();
  writeGuest([]);
  return list;
};

export const repositoryFor = (authenticated: boolean): FavouritesRepository =>
  authenticated ? serverFavourites : guestFavourites;
