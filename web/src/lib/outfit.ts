/**
 * «Одеватор» — подбор одежды по погоде.
 *
 * Считаем не от температуры воздуха, а от ощущаемой: при −5 °C и ветре 40 км/ч
 * человек мёрзнет как при −15 °C, и куртка нужна другая. Ветер, UV и осадки
 * добавляют слои и аксессуары поверх базового набора.
 */

export type OutfitSlot = 'outer' | 'mid' | 'legs' | 'head' | 'shoes' | 'accessory';

export interface OutfitItem {
  slot: OutfitSlot;
  label: string;
  /** Эмодзи для компактного показа рядом с подписью. */
  icon: string;
  /** Почему эта вещь попала в набор — показываем подсказкой. */
  why?: string;
}

export type OutfitTone = 'freezing' | 'cold' | 'chilly' | 'mild' | 'warm' | 'hot';

export interface Outfit {
  tone: OutfitTone;
  /** Ощущаемая температура, по которой собран набор, °C. */
  basis: number;
  title: string;
  items: OutfitItem[];
  advice: string[];
  /** Цвета для 3D-аватара: верх, низ, головной убор. */
  palette: { outer: string; legs: string; head: string | null; shoes: string };
}

export interface OutfitInput {
  temp: number;
  feelsLike?: number | null;
  /** Скорость ветра в единицах units: км/ч для metric, миль/ч для imperial. */
  wind?: number | null;
  uv?: number | null;
  /** Вероятность осадков, %. */
  precipProb?: number | null;
  /** Количество осадков за час, мм (или дюймы для imperial). */
  precipMm?: number | null;
  isDay?: boolean;
  units?: 'metric' | 'imperial';
}

const F_TO_C = (f: number) => ((f - 32) * 5) / 9;
const MPH_TO_KMH = 1.60934;
const INCH_TO_MM = 25.4;

const TONES: { max: number; tone: OutfitTone; title: string }[] = [
  { max: -20, tone: 'freezing', title: 'Экстремальный мороз' },
  { max: -10, tone: 'freezing', title: 'Сильный мороз' },
  { max: 0, tone: 'cold', title: 'Мороз' },
  { max: 7, tone: 'cold', title: 'Холодно' },
  { max: 14, tone: 'chilly', title: 'Прохладно' },
  { max: 20, tone: 'mild', title: 'Умеренно' },
  { max: 26, tone: 'warm', title: 'Тепло' },
  { max: Infinity, tone: 'hot', title: 'Жарко' },
];

/** Базовый набор по ощущаемой температуре, без учёта ветра, солнца и осадков. */
function baseLayers(feels: number): OutfitItem[] {
  if (feels < -20) {
    return [
      { slot: 'outer', label: 'Пуховик-парка', icon: '🧥', why: 'ниже −20 °C' },
      { slot: 'mid', label: 'Термобельё и флис', icon: '🧣' },
      { slot: 'legs', label: 'Утеплённые брюки', icon: '👖' },
      { slot: 'head', label: 'Шапка и балаклава', icon: '🧢' },
      { slot: 'shoes', label: 'Зимние ботинки', icon: '🥾' },
      { slot: 'accessory', label: 'Варежки', icon: '🧤' },
      { slot: 'accessory', label: 'Шарф на лицо', icon: '🧣', why: 'риск обморожения' },
    ];
  }
  if (feels < -10) {
    return [
      { slot: 'outer', label: 'Пуховик', icon: '🧥' },
      { slot: 'mid', label: 'Свитер или флис', icon: '🧶' },
      { slot: 'legs', label: 'Тёплые джинсы', icon: '👖' },
      { slot: 'head', label: 'Тёплая шапка', icon: '🧢' },
      { slot: 'shoes', label: 'Зимние ботинки', icon: '🥾' },
      { slot: 'accessory', label: 'Перчатки', icon: '🧤' },
      { slot: 'accessory', label: 'Шарф', icon: '🧣' },
    ];
  }
  if (feels < 0) {
    return [
      { slot: 'outer', label: 'Зимняя куртка', icon: '🧥' },
      { slot: 'mid', label: 'Свитер', icon: '🧶' },
      { slot: 'legs', label: 'Джинсы', icon: '👖' },
      { slot: 'head', label: 'Шапка', icon: '🧢' },
      { slot: 'shoes', label: 'Утеплённые ботинки', icon: '🥾' },
      { slot: 'accessory', label: 'Перчатки', icon: '🧤' },
    ];
  }
  if (feels < 7) {
    return [
      { slot: 'outer', label: 'Пальто или тёплая куртка', icon: '🧥' },
      { slot: 'mid', label: 'Свитер', icon: '🧶' },
      { slot: 'legs', label: 'Джинсы', icon: '👖' },
      { slot: 'head', label: 'Лёгкая шапка', icon: '🧢' },
      { slot: 'shoes', label: 'Закрытые ботинки', icon: '👞' },
    ];
  }
  if (feels < 14) {
    return [
      { slot: 'outer', label: 'Ветровка или лёгкая куртка', icon: '🧥' },
      { slot: 'mid', label: 'Лонгслив', icon: '👕' },
      { slot: 'legs', label: 'Джинсы', icon: '👖' },
      { slot: 'shoes', label: 'Кроссовки', icon: '👟' },
    ];
  }
  if (feels < 20) {
    return [
      { slot: 'outer', label: 'Толстовка или рубашка', icon: '👔' },
      { slot: 'legs', label: 'Джинсы', icon: '👖' },
      { slot: 'shoes', label: 'Кроссовки', icon: '👟' },
    ];
  }
  if (feels < 26) {
    return [
      { slot: 'mid', label: 'Футболка', icon: '👕' },
      { slot: 'legs', label: 'Лёгкие брюки', icon: '👖' },
      { slot: 'shoes', label: 'Кеды', icon: '👟' },
    ];
  }
  return [
    { slot: 'mid', label: 'Лёгкая футболка', icon: '👕' },
    { slot: 'legs', label: 'Шорты', icon: '🩳' },
    { slot: 'shoes', label: 'Сандалии', icon: '🩴' },
    { slot: 'head', label: 'Кепка', icon: '🧢', why: 'защита от перегрева' },
  ];
}

const PALETTES: Record<OutfitTone, Outfit['palette']> = {
  freezing: { outer: '#1e3a8a', legs: '#1f2937', head: '#b91c1c', shoes: '#111827' },
  cold: { outer: '#1d4ed8', legs: '#374151', head: '#7c3aed', shoes: '#1f2937' },
  chilly: { outer: '#0e7490', legs: '#3f3f46', head: null, shoes: '#27272a' },
  mild: { outer: '#15803d', legs: '#3730a3', head: null, shoes: '#e5e7eb' },
  warm: { outer: '#f59e0b', legs: '#0369a1', head: null, shoes: '#f3f4f6' },
  hot: { outer: '#fbbf24', legs: '#f472b6', head: '#fde68a', shoes: '#fcd34d' },
};

/**
 * Ощущаемая температура по формуле ветрового охлаждения (JAG/TI), если
 * провайдер её не прислал. Формула определена для t <= 10 °C и ветра >= 4.8 км/ч.
 */
export function windChill(tempC: number, windKmh: number): number {
  if (tempC > 10 || windKmh < 4.8) return tempC;
  const v = windKmh ** 0.16;
  return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
}

/** Собирает комплект одежды. Единицы приводятся к метрическим внутри. */
export function pickOutfit(input: OutfitInput): Outfit {
  const imperial = input.units === 'imperial';
  const temp = imperial ? F_TO_C(input.temp) : input.temp;
  const windKmh = Math.max(0, (input.wind ?? 0) * (imperial ? MPH_TO_KMH : 1));
  const precipMm = Math.max(0, (input.precipMm ?? 0) * (imperial ? INCH_TO_MM : 1));
  const uv = input.uv ?? 0;
  const precipProb = Math.max(0, Math.min(100, input.precipProb ?? 0));
  const isDay = input.isDay ?? true;

  const rawFeels = input.feelsLike == null
    ? null
    : imperial ? F_TO_C(input.feelsLike) : input.feelsLike;
  const feels = rawFeels ?? windChill(temp, windKmh);

  const band = TONES.find((t) => feels < t.max) ?? TONES[TONES.length - 1];
  const items = baseLayers(feels);
  const advice: string[] = [];

  /* --- ветер --- */
  if (windKmh >= 50) {
    advice.push(`Ветер ${Math.round(windKmh)} км/ч — зонт выворачивает, берите дождевик с капюшоном.`);
    if (!items.some((i) => i.slot === 'head')) {
      items.push({ slot: 'head', label: 'Капюшон', icon: '🧥', why: `ветер ${Math.round(windKmh)} км/ч` });
    }
  } else if (windKmh >= 30) {
    advice.push(`Ветрено (${Math.round(windKmh)} км/ч) — нужен ветрозащитный верхний слой.`);
    if (feels < 14 && !items.some((i) => i.slot === 'head')) {
      items.push({ slot: 'head', label: 'Шапка или капюшон', icon: '🧢', why: 'сдувает тепло' });
    }
  }

  /* --- осадки --- */
  const rainy = precipProb >= 40 || precipMm > 0.1;
  if (rainy) {
    const snow = temp <= 1;
    if (snow) {
      advice.push('Осадки при отрицательной температуре — под ногами будет скользко.');
      items.push({ slot: 'shoes', label: 'Обувь с рифлёной подошвой', icon: '🥾', why: 'гололёд' });
    } else if (windKmh < 50) {
      items.push({
        slot: 'accessory', label: 'Зонт', icon: '☂️',
        why: `вероятность осадков ${Math.round(precipProb)}%`,
      });
    }
    if (precipProb >= 60 && !snow) {
      items.push({ slot: 'outer', label: 'Непромокаемая куртка', icon: '🧥', why: 'дождь почти наверняка' });
      advice.push('Замшу и текстильные кроссовки лучше оставить дома.');
    }
  }

  /* --- солнце --- */
  if (isDay && uv >= 3) {
    items.push({ slot: 'accessory', label: 'Солнцезащитные очки', icon: '🕶️', why: `UV ${uv.toFixed(0)}` });
  }
  if (isDay && uv >= 6) {
    if (!items.some((i) => i.slot === 'head')) {
      items.push({ slot: 'head', label: 'Панама или кепка', icon: '👒', why: `UV ${uv.toFixed(0)}` });
    }
    advice.push(`UV-индекс ${uv.toFixed(0)} — нанесите SPF за 20 минут до выхода.`);
  }
  if (isDay && uv >= 8) {
    advice.push('С 11 до 16 часов лучше держаться тени: ожог возможен за 15–20 минут.');
  }

  /* --- крайности --- */
  if (feels <= -25) advice.push('Открытая кожа обмораживается за 10–15 минут. Ограничьте время на улице.');
  if (feels >= 32) advice.push('Пейте воду каждые 20–30 минут и избегайте нагрузок в полдень.');
  if (!advice.length) advice.push('Погода без сюрпризов — берите то, что удобно.');

  return {
    tone: band.tone,
    basis: Math.round(feels * 10) / 10,
    title: band.title,
    items: dedupe(items),
    advice,
    palette: PALETTES[band.tone],
  };
}

/** Один слот — одна вещь; последняя добавленная перебивает базовую. */
function dedupe(items: OutfitItem[]): OutfitItem[] {
  const single: OutfitSlot[] = ['outer', 'mid', 'legs', 'head', 'shoes'];
  const out: OutfitItem[] = [];
  for (const item of items) {
    if (!single.includes(item.slot)) { out.push(item); continue; }
    const idx = out.findIndex((x) => x.slot === item.slot);
    if (idx >= 0) out[idx] = item;
    else out.push(item);
  }
  // аксессуары не дублируем по названию
  const seen = new Set<string>();
  return out.filter((i) => {
    const k = i.slot + ':' + i.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const SLOT_TITLES: Record<OutfitSlot, string> = {
  outer: 'Верхняя одежда',
  mid: 'Средний слой',
  legs: 'Низ',
  head: 'Головной убор',
  shoes: 'Обувь',
  accessory: 'Аксессуары',
};
