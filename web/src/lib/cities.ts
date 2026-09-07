/**
 * Города для меток на глобусе: столицы + крупнейшие агломерации мира.
 *
 * Столицы лежат в отдельном файле [capitals.ts] — они появились раньше и на них
 * завязан лендинг. Здесь мы их дополняем мегаполисами, которые столицами не
 * являются (Шанхай, Нью-Йорк, Стамбул и прочие), и отдаём наружу один общий
 * список с признаком типа.
 */

// Расширение указано явно, чтобы модуль резолвился не только сборщиком, но и
// голым Node: юнит-тесты импортируют этот файл напрямую (tests/logic.test.mjs).
import { CAPITALS, type Capital } from './capitals.ts';

export type CityKind = 'capital' | 'metro';

export interface WorldCity {
  name: string;
  country: string;
  lat: number;
  lon: number;
  kind: CityKind;
  /** Подписываем без наведения — самые узнаваемые узлы. */
  major: boolean;
  /** Население агломерации, млн. Только для мегаполисов — влияет на размер точки. */
  populationM?: number;
}

/** Крупнейшие агломерации, не являющиеся столицами. */
const MEGACITIES: Omit<WorldCity, 'kind'>[] = [
  { name: 'Шанхай', country: 'Китай', lat: 31.2304, lon: 121.4737, major: true, populationM: 29.2 },
  { name: 'Нью-Йорк', country: 'США', lat: 40.7128, lon: -74.006, major: true, populationM: 18.9 },
  { name: 'Сан-Паулу', country: 'Бразилия', lat: -23.5505, lon: -46.6333, major: true, populationM: 22.8 },
  { name: 'Мумбаи', country: 'Индия', lat: 19.076, lon: 72.8777, major: true, populationM: 21.7 },
  { name: 'Осака', country: 'Япония', lat: 34.6937, lon: 135.5023, major: false, populationM: 19.0 },
  { name: 'Чунцин', country: 'Китай', lat: 29.563, lon: 106.5516, major: false, populationM: 17.3 },
  { name: 'Карачи', country: 'Пакистан', lat: 24.8607, lon: 67.0011, major: true, populationM: 17.2 },
  { name: 'Стамбул', country: 'Турция', lat: 41.0082, lon: 28.9784, major: true, populationM: 16.0 },
  { name: 'Калькутта', country: 'Индия', lat: 22.5726, lon: 88.3639, major: false, populationM: 15.6 },
  { name: 'Лагос', country: 'Нигерия', lat: 6.5244, lon: 3.3792, major: true, populationM: 15.4 },
  { name: 'Рио-де-Жанейро', country: 'Бразилия', lat: -22.9068, lon: -43.1729, major: true, populationM: 13.7 },
  { name: 'Гуанчжоу', country: 'Китай', lat: 23.1291, lon: 113.2644, major: false, populationM: 14.3 },
  { name: 'Лос-Анджелес', country: 'США', lat: 34.0522, lon: -118.2437, major: true, populationM: 12.5 },
  { name: 'Шэньчжэнь', country: 'Китай', lat: 22.5431, lon: 114.0579, major: false, populationM: 12.8 },
  { name: 'Лахор', country: 'Пакистан', lat: 31.5204, lon: 74.3587, major: false, populationM: 13.5 },
  { name: 'Бангалор', country: 'Индия', lat: 12.9716, lon: 77.5946, major: false, populationM: 13.2 },
  { name: 'Ченнаи', country: 'Индия', lat: 13.0827, lon: 80.2707, major: false, populationM: 11.5 },
  { name: 'Нагоя', country: 'Япония', lat: 35.1815, lon: 136.9066, major: false, populationM: 9.5 },
  { name: 'Хайдарабад', country: 'Индия', lat: 17.385, lon: 78.4867, major: false, populationM: 10.5 },
  { name: 'Чикаго', country: 'США', lat: 41.8781, lon: -87.6298, major: false, populationM: 8.9 },
  { name: 'Чэнду', country: 'Китай', lat: 30.5728, lon: 104.0668, major: false, populationM: 9.5 },
  { name: 'Ухань', country: 'Китай', lat: 30.5928, lon: 114.3055, major: false, populationM: 9.0 },
  { name: 'Хошимин', country: 'Вьетнам', lat: 10.8231, lon: 106.6297, major: false, populationM: 9.3 },
  { name: 'Ахмадабад', country: 'Индия', lat: 23.0225, lon: 72.5714, major: false, populationM: 8.6 },
  { name: 'Сиань', country: 'Китай', lat: 34.3416, lon: 108.9398, major: false, populationM: 8.2 },
  { name: 'Гонконг', country: 'Китай', lat: 22.3193, lon: 114.1694, major: true, populationM: 7.6 },
  { name: 'Ханчжоу', country: 'Китай', lat: 30.2741, lon: 120.1551, major: false, populationM: 8.0 },
  { name: 'Шэньян', country: 'Китай', lat: 41.8057, lon: 123.4315, major: false, populationM: 7.1 },
  { name: 'Сурат', country: 'Индия', lat: 21.1702, lon: 72.8311, major: false, populationM: 7.8 },
  { name: 'Сучжоу', country: 'Китай', lat: 31.2989, lon: 120.5853, major: false, populationM: 7.4 },
  { name: 'Пуна', country: 'Индия', lat: 18.5204, lon: 73.8567, major: false, populationM: 7.0 },
  { name: 'Харбин', country: 'Китай', lat: 45.8038, lon: 126.5349, major: false, populationM: 6.5 },
  { name: 'Хьюстон', country: 'США', lat: 29.7604, lon: -95.3698, major: false, populationM: 6.7 },
  { name: 'Даллас', country: 'США', lat: 32.7767, lon: -96.797, major: false, populationM: 6.4 },
  { name: 'Торонто', country: 'Канада', lat: 43.6532, lon: -79.3832, major: true, populationM: 6.4 },
  { name: 'Майами', country: 'США', lat: 25.7617, lon: -80.1918, major: false, populationM: 6.3 },
  { name: 'Филадельфия', country: 'США', lat: 39.9526, lon: -75.1652, major: false, populationM: 5.8 },
  { name: 'Атланта', country: 'США', lat: 33.749, lon: -84.388, major: false, populationM: 5.8 },
  { name: 'Фукуока', country: 'Япония', lat: 33.5904, lon: 130.4017, major: false, populationM: 5.6 },
  { name: 'Барселона', country: 'Испания', lat: 41.3851, lon: 2.1734, major: false, populationM: 5.6 },
  { name: 'Йоханнесбург', country: 'ЮАР', lat: -26.2041, lon: 28.0473, major: true, populationM: 6.2 },
  { name: 'Санкт-Петербург', country: 'Россия', lat: 59.9311, lon: 30.3609, major: true, populationM: 5.5 },
  { name: 'Циндао', country: 'Китай', lat: 36.0671, lon: 120.3826, major: false, populationM: 5.5 },
  { name: 'Далянь', country: 'Китай', lat: 38.914, lon: 121.6147, major: false, populationM: 4.5 },
  { name: 'Янгон', country: 'Мьянма', lat: 16.8409, lon: 96.1735, major: false, populationM: 5.6 },
  { name: 'Александрия', country: 'Египет', lat: 31.2001, lon: 29.9187, major: false, populationM: 5.6 },
  { name: 'Джидда', country: 'Саудовская Аравия', lat: 21.4858, lon: 39.1925, major: false, populationM: 4.9 },
  { name: 'Мельбурн', country: 'Австралия', lat: -37.8136, lon: 144.9631, major: true, populationM: 5.2 },
  { name: 'Сидней', country: 'Австралия', lat: -33.8688, lon: 151.2093, major: true, populationM: 5.3 },
  { name: 'Касабланка', country: 'Марокко', lat: 33.5731, lon: -7.5898, major: false, populationM: 4.4 },
  { name: 'Абиджан', country: 'Кот-д’Ивуар', lat: 5.36, lon: -4.0083, major: false, populationM: 5.6 },
  { name: 'Кано', country: 'Нигерия', lat: 12.0022, lon: 8.592, major: false, populationM: 4.2 },
  { name: 'Милан', country: 'Италия', lat: 45.4642, lon: 9.19, major: false, populationM: 4.3 },
  { name: 'Гвадалахара', country: 'Мексика', lat: 20.6597, lon: -103.3496, major: false, populationM: 5.3 },
  { name: 'Монтеррей', country: 'Мексика', lat: 25.6866, lon: -100.3161, major: false, populationM: 5.1 },
  { name: 'Неаполь', country: 'Италия', lat: 40.8518, lon: 14.2681, major: false, populationM: 4.4 },
  { name: 'Тель-Авив', country: 'Израиль', lat: 32.0853, lon: 34.7818, major: false, populationM: 4.2 },
  { name: 'Дубай', country: 'ОАЭ', lat: 25.2048, lon: 55.2708, major: true, populationM: 3.6 },
  { name: 'Медельин', country: 'Колумбия', lat: 6.2442, lon: -75.5812, major: false, populationM: 4.1 },
  { name: 'Сальвадор', country: 'Бразилия', lat: -12.9777, lon: -38.5016, major: false, populationM: 3.9 },
  { name: 'Порту-Алегри', country: 'Бразилия', lat: -30.0346, lon: -51.2177, major: false, populationM: 4.3 },
  { name: 'Ванкувер', country: 'Канада', lat: 49.2827, lon: -123.1207, major: false, populationM: 2.7 },
  { name: 'Сиэтл', country: 'США', lat: 47.6062, lon: -122.3321, major: false, populationM: 4.0 },
  { name: 'Сан-Франциско', country: 'США', lat: 37.7749, lon: -122.4194, major: true, populationM: 4.7 },
  { name: 'Новосибирск', country: 'Россия', lat: 55.0084, lon: 82.9357, major: false, populationM: 1.6 },
  { name: 'Екатеринбург', country: 'Россия', lat: 56.8389, lon: 60.6057, major: false, populationM: 1.5 },
  { name: 'Одесса', country: 'Украина', lat: 46.4825, lon: 30.7233, major: false, populationM: 1.0 },
  { name: 'Харьков', country: 'Украина', lat: 49.9935, lon: 36.2304, major: false, populationM: 1.4 },
  { name: 'Львов', country: 'Украина', lat: 49.8397, lon: 24.0297, major: false, populationM: 0.7 },
];

const capitalToCity = (c: Capital): WorldCity => ({
  name: c.name,
  country: c.country,
  lat: c.lat,
  lon: c.lon,
  kind: 'capital',
  major: !!c.major,
});

/**
 * Единый список меток глобуса.
 *
 * Дубли отсекаем по координатам: Сидней и Дубай есть и среди мегаполисов, и в
 * витрине лендинга, а Претория/Канберра — среди столиц. Столица выигрывает.
 */
export const WORLD_CITIES: WorldCity[] = (() => {
  const out: WorldCity[] = CAPITALS.map(capitalToCity);
  const key = (lat: number, lon: number) => `${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const seen = new Set(out.map((c) => key(c.lat, c.lon)));

  for (const m of MEGACITIES) {
    const k = key(m.lat, m.lon);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...m, kind: 'metro' });
  }
  return out;
})();

export const CITY_COUNT = {
  capitals: WORLD_CITIES.filter((c) => c.kind === 'capital').length,
  metros: WORLD_CITIES.filter((c) => c.kind === 'metro').length,
  total: WORLD_CITIES.length,
};
