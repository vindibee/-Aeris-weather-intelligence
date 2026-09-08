/**
 * Бытовые индексы: автомойка, сушка белья, выгул питомцев.
 *
 * Всё считается из уже загруженного прогноза — дополнительных запросов к API
 * не требуется. Единицы приводятся к метрическим внутри, чтобы имперский режим
 * не ломал пороги.
 */

export type IndexLevel = 'great' | 'good' | 'fair' | 'poor' | 'bad';

/**
 * Переводчик передаётся параметром.
 *
 * Модуль чистый — ни React, ни хуков, — поэтому t() здесь не вызвать.
 * Раньше это и было причиной, по которой вердикты индексов оставались
 * русскими на любом языке: текст собирался прямо здесь.
 */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

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
export function carWashIndex(days: CarWashDay[], t: Translate, u: UnitContext = { units: 'metric' }): IndexResult {
  const window = days.slice(0, 3);
  if (!window.length) {
    return {
      level: 'fair', score: 50, verdict: t('idx.noData'),
      detail: t('idx.noDataDetail'), notes: [],
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
  const dayWord = firstWet >= 0 ? t(`idx.day${firstWet}`) : '';

  const verdict =
    level === 'great' ? t('idx.cwGreat')
    : level === 'good' ? t('idx.cwGood')
    : level === 'fair' ? t('idx.cwFair')
    : level === 'poor' ? t('idx.cwPoor', { day: dayWord })
    : t('idx.cwBad', { day: dayWord });

  const notes: string[] = [];
  window.forEach((d, i) => {
    const prob = Math.round(d.precipProbMax ?? 0);
    const mm = toMm(d.precipSum ?? 0, u);
    notes.push(
      t('idx.cwNote', { day: i < 3 ? t(`idx.dayCap${i}`) : d.date, prob }) +
      (mm >= 0.1 ? t('idx.cwUpTo', { mm: mm.toFixed(1) }) : '')
    );
  });

  return {
    level, score, verdict,
    detail: firstWet >= 0
      ? t('idx.cwFirstWet', { day: dayWord, days: firstWet })
      : t('idx.cwDry'),
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
export function laundryIndex(input: LaundryInput, t: Translate, u: UnitContext = { units: 'metric' }): IndexResult {
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
    notes.push(t('idx.lnFrost'));
  }
  if (rh >= 95) {
    notes.push(t('idx.lnHumid'));
  }
  if (precipProb >= 50) {
    notes.push(t('idx.lnRainRisk', { prob: Math.round(precipProb) }));
  }
  if (input.isDay === false) {
    hours *= 1.35;
    notes.push(t('idx.lnNight'));
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
    capped < 1.5 ? t('idx.lnQuick')
    : capped < 10 ? t('idx.lnAbout', { h: capped.toFixed(capped < 4 ? 1 : 0) })
    : capped < 24 ? t('idx.lnHours', { h: Math.round(capped) })
    : t('idx.lnOverDay');

  return {
    level, score,
    verdict: impossible ? t('idx.lnUseless')
      : level === 'great' ? t('idx.lnIdeal')
      : level === 'good' ? t('idx.lnFast')
      : level === 'fair' ? t('idx.lnSlow')
      : t('idx.lnVerySlow'),
    detail: impossible
      ? t('idx.lnSaturated')
      : t('idx.lnEta', { time: humanTime }),
    notes: notes.length ? notes
      : [t('idx.lnVpd', { vpd: vpd.toFixed(2), wind: windMs.toFixed(1) })],
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

export function petWalkIndex(input: PetWalkInput, t: Translate, u: UnitContext = { units: 'metric' }): IndexResult {
  const tC = toC(input.temp, u);
  const feels = input.feelsLike == null ? tC : toC(input.feelsLike, u);
  const uv = input.uv ?? 0;
  const isDay = input.isDay ?? true;
  const windKmh = toKmh(input.wind ?? 0, u);
  const precipProb = Math.max(0, Math.min(100, input.precipProb ?? 0));

  const pavement = pavementTemp(tC, uv, isDay);
  const notes: string[] = [];
  let score = 100;
  let verdict = t('idx.ptGreat');
  let detail = t('idx.ptPavementOk', { c: Math.round(pavement) });

  /* жара */
  if (pavement >= 52) {
    score = 8;
    verdict = t('idx.ptDanger');
    detail = t('idx.ptPavementHot', { c: Math.round(pavement) });
    notes.push(t('idx.ptAdviceHot'));
  } else if (pavement >= 45) {
    score = 32;
    verdict = t('idx.ptWarm');
    detail = t('idx.ptPavementWarm', { c: Math.round(pavement) });
    notes.push(t('idx.ptAdviceWarm'));
  } else if (tC >= 27) {
    score = 50;
    verdict = t('idx.ptHot');
    detail = t('idx.ptAirHot', { air: Math.round(tC), pav: Math.round(pavement) });
    notes.push(t('idx.ptAdviceAir'));
  }

  /* холод */
  if (feels <= -20) {
    score = Math.min(score, 10);
    verdict = t('idx.ptFrostCritical');
    detail = t('idx.ptFeelsFrost', { c: Math.round(feels) });
    notes.push(t('idx.ptAdviceFrost'));
  } else if (feels <= -10) {
    score = Math.min(score, 35);
    verdict = t('idx.ptFrost');
    detail = t('idx.ptFeels', { c: Math.round(feels) });
    notes.push(t('idx.ptAdviceCold'));
  } else if (tC <= 2 && tC >= -8) {
    score = Math.min(score, 62);
    if (verdict === t('idx.ptGreat')) verdict = t('idx.ptReagents');
    notes.push(t('idx.ptReagentsNote'));
  }

  /* прочее */
  if (uv >= 8 && isDay) {
    score = Math.min(score, 55);
    notes.push(t('idx.ptUv'));
  }
  if (windKmh >= 45) {
    score = Math.min(score, 55);
    notes.push(t('idx.ptGusts', { kmh: Math.round(windKmh) }));
  }
  if (precipProb >= 60) {
    score = Math.min(score, 60);
    notes.push(t('idx.ptRain', { prob: Math.round(precipProb) }));
  }

  if (!notes.length) notes.push(t('idx.ptNoLimits'));

  return { level: LEVEL_BY_SCORE(score), score, verdict, detail, notes };
}

export const LEVEL_COLOR: Record<IndexLevel, string> = {
  great: '#4ade80',
  good: '#a3e635',
  fair: '#fbbf24',
  poor: '#fb923c',
  bad: '#f43f5e',
};

/* Ключи словаря: подпись уровня переводится там, где есть t(). */
export const LEVEL_LABEL_KEY: Record<IndexLevel, string> = {
  great: 'idx.lvGreat',
  good: 'idx.lvGood',
  fair: 'idx.lvFair',
  poor: 'idx.lvPoor',
  bad: 'idx.lvBad',
};
