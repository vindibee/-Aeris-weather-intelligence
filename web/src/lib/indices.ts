/**
 * Бытовые индексы: автомойка, сушка белья, выгул питомцев.
 *
 * Всё считается из уже загруженного прогноза — дополнительных запросов к API
 * не требуется. Единицы приводятся к метрическим внутри, чтобы имперский режим
 * не ломал пороги.
 */

export type IndexLevel = 'great' | 'good' | 'fair' | 'poor' | 'bad';

export interface IndexResult {
  level: IndexLevel;
  /** 0–100, выше — лучше. Для выгула питомцев — выше значит безопаснее. */
  score: number;
  verdict: string;
  detail: string;
  /** Дополнительные строки-подсказки. */
  notes: string[];
}

const F_TO_C = (f: number) => ((f - 32) * 5) / 9;
const MPH_TO_KMH = 1.60934;
const INCH_TO_MM = 25.4;

export interface UnitContext {
  units: 'metric' | 'imperial';
}

const toC = (v: number, u: UnitContext) => (u.units === 'imperial' ? F_TO_C(v) : v);
const toKmh = (v: number, u: UnitContext) => (u.units === 'imperial' ? v * MPH_TO_KMH : v);
const toMm = (v: number, u: UnitContext) => (u.units === 'imperial' ? v * INCH_TO_MM : v);

const LEVEL_BY_SCORE = (score: number): IndexLevel =>
  score >= 85 ? 'great' : score >= 65 ? 'good' : score >= 45 ? 'fair' : score >= 25 ? 'poor' : 'bad';

/* ------------------------------------------------------------------ */
/*  1. Индекс автомойки                                                */
/* ------------------------------------------------------------------ */

export interface CarWashDay {
  /** ISO-дата. */
  date: string;
  precipProbMax: number | null;
  precipSum: number | null;
  windMax?: number | null;
}

/**
 * Риск того, что машина испачкается в ближайшие трое суток.
 *
 * Ближний день весит больше дальнего: дождь завтра обиднее, чем послезавтра,
 * когда машина уже успела покататься чистой.
 */
export function carWashIndex(days: CarWashDay[], u: UnitContext = { units: 'metric' }): IndexResult {
  const window = days.slice(0, 3);
  if (!window.length) {
    return {
      level: 'fair', score: 50, verdict: 'Нет данных',
      detail: 'Прогноз на ближайшие сутки недоступен.', notes: [],
    };
  }

  const WEIGHTS = [1, 0.65, 0.4];

  // Берём максимум, а не среднее. Усреднение размывало гарантированный ливень
  // завтра двумя сухими днями по краям и выдавало «можно мыть» — а машина
  // всё равно будет грязной. Индекс должен смотреть на худшее близкое событие.
  const risk = window.reduce((worst, d, i) => {
    const w = WEIGHTS[i] ?? 0.3;
    const prob = Math.max(0, Math.min(100, d.precipProbMax ?? 0)) / 100;
    const mm = Math.max(0, toMm(d.precipSum ?? 0, u));
    // миллиметры важнее вероятности: 0.2 мм мороси машину почти не тронут,
    // а 8 мм ливня смоют любую полировку
    const volume = Math.min(1, mm / 8);
    return Math.max(worst, w * Math.max(prob * 0.7, volume));
  }, 0);

  const score = Math.round((1 - risk) * 100);
  const level = LEVEL_BY_SCORE(score);

  const firstWet = window.findIndex(
    (d) => (d.precipProbMax ?? 0) >= 50 || toMm(d.precipSum ?? 0, u) >= 1
  );
  const dayWord = ['сегодня', 'завтра', 'послезавтра'][firstWet] ?? '';

  const verdict =
    level === 'great' ? 'Отличный день для мойки'
    : level === 'good' ? 'Можно мыть'
    : level === 'fair' ? 'Мойка на свой риск'
    : level === 'poor' ? `Лучше подождать: дождь ${dayWord}`
    : `Не стоит, дождь ${dayWord}`;

  const notes: string[] = [];
  window.forEach((d, i) => {
    const prob = Math.round(d.precipProbMax ?? 0);
    const mm = toMm(d.precipSum ?? 0, u);
    notes.push(
      `${['Сегодня', 'Завтра', 'Послезавтра'][i] ?? d.date}: ${prob}% осадков` +
      (mm >= 0.1 ? `, до ${mm.toFixed(1)} мм` : '')
    );
  });

  return {
    level, score, verdict,
    detail: firstWet >= 0
      ? `Ближайшие осадки — ${dayWord}. Чистой машина останется примерно ${firstWet} сут.`
      : 'Осадков в ближайшие трое суток не ожидается.',
    notes,
  };
}

/* ------------------------------------------------------------------ */
/*  2. Индекс сушки белья                                              */
/* ------------------------------------------------------------------ */

export interface LaundryInput {
  temp: number;
  humidity: number;
  wind: number;
  precipProb?: number | null;
  isDay?: boolean;
}

/** Давление насыщенного пара, кПа (формула Тетенса). */
const saturationPressure = (tC: number) => 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));

/**
 * Оценка времени высыхания на улице.
 *
 * Скорость испарения пропорциональна дефициту давления пара и растёт с ветром.
 * Константа подобрана так, чтобы эталонные условия (20 °C, 50%, 2 м/с) давали
 * около 3 часов — то, что обычно и получается на практике.
 */
export function laundryIndex(input: LaundryInput, u: UnitContext = { units: 'metric' }): IndexResult {
  const tC = toC(input.temp, u);
  const rh = Math.max(0, Math.min(100, input.humidity));
  const windMs = toKmh(input.wind, u) / 3.6;
  const precipProb = Math.max(0, Math.min(100, input.precipProb ?? 0));

  const vpd = saturationPressure(tC) * (1 - rh / 100);
  const rate = Math.max(0.001, vpd * (1 + 0.4 * Math.max(0, windMs)));
  const K = 6.31;
  let hours = K / rate;

  const notes: string[] = [];

  // мороз: вода не испаряется, а вымерзает — процесс идёт, но медленно
  if (tC <= 0) {
    hours *= 1.8;
    notes.push('Ниже нуля бельё сохнет вымораживанием — долго, но сохнет.');
  }
  if (rh >= 95) {
    notes.push('Влажность выше 95% — на улице бельё практически не сохнет.');
  }
  if (precipProb >= 50) {
    notes.push(`Вероятность осадков ${Math.round(precipProb)}% — вешать на улицу рискованно.`);
  }
  if (input.isDay === false) {
    hours *= 1.35;
    notes.push('Ночью испарение слабее, к утру бельё может отсыреть от росы.');
  }

  const impossible = rh >= 95 || precipProb >= 70;
  const capped = Math.min(48, hours);

  /*
   * Оценка падает экспоненциально со временем сушки, но у «просто медленно»
   * есть пол: уровень bad означает «сушить бесполезно», и путать с ним
   * январское вымораживание за сутки нельзя — бельё в итоге высохнет.
   */
  const raw = Math.round(100 * Math.exp(-(capped - 1) / 8));
  // пол = нижняя граница уровня poor, иначе «медленно» скатывается в «бесполезно»
  const score = impossible ? 8 : Math.max(25, Math.min(100, raw));
  const level: IndexLevel = impossible ? 'bad' : LEVEL_BY_SCORE(score);

  const humanTime =
    capped < 1.5 ? 'меньше полутора часов'
    : capped < 10 ? `около ${capped.toFixed(capped < 4 ? 1 : 0)} ч`
    : capped < 24 ? `${Math.round(capped)} ч`
    : 'больше суток';

  return {
    level, score,
    verdict: impossible ? 'Сушить на улице бесполезно'
      : level === 'great' ? 'Идеально для сушки'
      : level === 'good' ? 'Высохнет быстро'
      : level === 'fair' ? 'Высохнет, но не скоро'
      : 'Сохнуть будет долго',
    detail: impossible
      ? 'Воздух насыщен влагой или ожидаются осадки.'
      : `Ориентировочное время высыхания — ${humanTime}.`,
    notes: notes.length ? notes : [`Дефицит влажности ${vpd.toFixed(2)} кПа, ветер ${windMs.toFixed(1)} м/с.`],
  };
}

/* ------------------------------------------------------------------ */
/*  3. Индекс выгула питомцев                                          */
/* ------------------------------------------------------------------ */

export interface PetWalkInput {
  temp: number;
  feelsLike?: number | null;
  uv?: number | null;
  wind?: number | null;
  precipProb?: number | null;
  isDay?: boolean;
}

/**
 * Температура асфальта.
 *
 * Тёмное покрытие под прямым солнцем нагревается на 20–30 °C выше воздуха;
 * в тени и ночью разница невелика. Порог ожога подушечек — около 52 °C
 * (примерно минута контакта), дискомфорт начинается с 45 °C.
 */
export function pavementTemp(airC: number, uv: number, isDay: boolean): number {
  if (!isDay) return airC + 2;
  const gain = uv >= 8 ? 28 : uv >= 6 ? 24 : uv >= 3 ? 17 : 9;
  return airC + gain;
}

export function petWalkIndex(input: PetWalkInput, u: UnitContext = { units: 'metric' }): IndexResult {
  const tC = toC(input.temp, u);
  const feels = input.feelsLike == null ? tC : toC(input.feelsLike, u);
  const uv = input.uv ?? 0;
  const isDay = input.isDay ?? true;
  const windKmh = toKmh(input.wind ?? 0, u);
  const precipProb = Math.max(0, Math.min(100, input.precipProb ?? 0));

  const pavement = pavementTemp(tC, uv, isDay);
  const notes: string[] = [];
  let score = 100;
  let verdict = 'Отличная погода для прогулки';
  let detail = `Асфальт около ${Math.round(pavement)} °C — комфортно для лап.`;

  /* жара */
  if (pavement >= 52) {
    score = 8;
    verdict = 'Опасно: асфальт обжигает лапы';
    detail = `Покрытие разогрето до ~${Math.round(pavement)} °C. Ожог подушечек возможен за минуту.`;
    notes.push('Гуляйте до 8 утра или после 20 часов, держитесь травы и тени.');
  } else if (pavement >= 45) {
    score = 32;
    verdict = 'Горячее покрытие';
    detail = `Асфальт около ${Math.round(pavement)} °C — уже некомфортно.`;
    notes.push('Проверьте ладонью: не терпите 7 секунд — не выдержит и питомец.');
  } else if (tC >= 27) {
    score = 50;
    verdict = 'Жарко, гуляйте недолго';
    detail = `Воздух ${Math.round(tC)} °C, покрытие около ${Math.round(pavement)} °C.`;
    notes.push('Берите воду, избегайте нагрузок, следите за одышкой.');
  }

  /* холод */
  if (feels <= -20) {
    score = Math.min(score, 10);
    verdict = 'Критический мороз';
    detail = `Ощущается как ${Math.round(feels)} °C — обморожение лап и ушей за считаные минуты.`;
    notes.push('Только по нужде, 5–10 минут, в комбинезоне и ботинках.');
  } else if (feels <= -10) {
    score = Math.min(score, 35);
    verdict = 'Сильный мороз';
    detail = `Ощущается как ${Math.round(feels)} °C.`;
    notes.push('Короткие прогулки; мелким и короткошёрстным нужна одежда.');
  } else if (tC <= 2 && tC >= -8) {
    score = Math.min(score, 62);
    if (verdict === 'Отличная погода для прогулки') verdict = 'Осторожно с реагентами';
    notes.push('Сезон противогололёдных реагентов — мойте лапы после прогулки, они разъедают подушечки.');
  }

  /* прочее */
  if (uv >= 8 && isDay) {
    score = Math.min(score, 55);
    notes.push('Высокий UV: светлые носы и уши обгорают так же, как человеческая кожа.');
  }
  if (windKmh >= 45) {
    score = Math.min(score, 55);
    notes.push(`Порывы до ${Math.round(windKmh)} км/ч — мелкие породы лучше не выгуливать долго.`);
  }
  if (precipProb >= 60) {
    score = Math.min(score, 60);
    notes.push(`Вероятность осадков ${Math.round(precipProb)}% — пригодится дождевик.`);
  }

  if (!notes.length) notes.push('Ограничений нет — можно гулять сколько угодно.');

  return { level: LEVEL_BY_SCORE(score), score, verdict, detail, notes };
}

export const LEVEL_COLOR: Record<IndexLevel, string> = {
  great: '#4ade80',
  good: '#a3e635',
  fair: '#fbbf24',
  poor: '#fb923c',
  bad: '#f43f5e',
};

export const LEVEL_LABEL: Record<IndexLevel, string> = {
  great: 'отлично',
  good: 'хорошо',
  fair: 'средне',
  poor: 'плохо',
  bad: 'не стоит',
};
