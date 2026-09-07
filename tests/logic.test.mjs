/**
 * Тесты чистой логики: подбор одежды и бытовые индексы.
 *
 * Импортируем .ts напрямую — Node 24 снимает типы сам, отдельная сборка для
 * тестов не нужна.
 *
 *   node --test tests/logic.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { pickOutfit, windChill } from '../web/src/lib/outfit.ts';
import { carWashIndex, laundryIndex, petWalkIndex, pavementTemp } from '../web/src/lib/indices.ts';
import { WORLD_CITIES, CITY_COUNT } from '../web/src/lib/cities.ts';

const labels = (o) => o.items.map((i) => i.label);
const slots = (o, slot) => o.items.filter((i) => i.slot === slot).map((i) => i.label);

/* ------------------------------------------------------------------ */
/*  Гардероб                                                           */
/* ------------------------------------------------------------------ */

test('мороз: пуховик, шапка и перчатки', () => {
  const o = pickOutfit({ temp: -18, feelsLike: -24, wind: 15 });
  assert.equal(o.tone, 'freezing');
  assert.ok(labels(o).some((l) => /Пуховик/.test(l)), labels(o).join(', '));
  assert.equal(slots(o, 'head').length, 1);
  assert.ok(labels(o).some((l) => /Варежки|Перчатки/.test(l)));
});

test('жара: шорты, сандалии и кепка', () => {
  const o = pickOutfit({ temp: 31, feelsLike: 33, uv: 9, isDay: true });
  assert.equal(o.tone, 'hot');
  assert.ok(labels(o).includes('Шорты'));
  assert.ok(labels(o).includes('Солнцезащитные очки'), 'при UV 9 нужны очки');
  assert.equal(slots(o, 'head').length, 1, 'ровно один головной убор');
  assert.ok(o.advice.some((a) => /SPF/.test(a)));
});

test('ветер учитывается через ощущаемую температуру', () => {
  const calm = pickOutfit({ temp: -3, wind: 0 });
  const windy = pickOutfit({ temp: -3, wind: 45 });
  assert.ok(windy.basis < calm.basis, `${windy.basis} должно быть ниже ${calm.basis}`);
  assert.ok(windy.advice.some((a) => /етр/.test(a)));
});

test('windChill не применяется выше +10 и при слабом ветре', () => {
  assert.equal(windChill(15, 40), 15);
  assert.equal(windChill(-5, 2), -5);
  assert.ok(windChill(-5, 40) < -10);
});

test('дождь добавляет зонт, сильный ветер — дождевик вместо зонта', () => {
  const rain = pickOutfit({ temp: 12, precipProb: 70 });
  assert.ok(labels(rain).includes('Зонт'));
  assert.ok(labels(rain).some((l) => /Непромокаемая/.test(l)));

  const storm = pickOutfit({ temp: 12, precipProb: 70, wind: 60 });
  assert.ok(!labels(storm).includes('Зонт'), 'при 60 км/ч зонт бесполезен');
  assert.ok(storm.advice.some((a) => /дождевик/.test(a)));
});

test('осадки при отрицательной температуре — про гололёд, а не про зонт', () => {
  const o = pickOutfit({ temp: -2, precipProb: 80 });
  assert.ok(!labels(o).includes('Зонт'));
  assert.ok(labels(o).some((l) => /рифлёной подошвой/.test(l)));
});

test('ночью солнцезащитные аксессуары не предлагаются', () => {
  const o = pickOutfit({ temp: 24, uv: 9, isDay: false });
  assert.ok(!labels(o).includes('Солнцезащитные очки'));
});

test('имперские единицы дают тот же набор, что и метрические', () => {
  const metric = pickOutfit({ temp: 0, feelsLike: -5, wind: 20, units: 'metric' });
  const imperial = pickOutfit({ temp: 32, feelsLike: 23, wind: 12.43, units: 'imperial' });
  assert.equal(metric.tone, imperial.tone);
  assert.ok(Math.abs(metric.basis - imperial.basis) < 0.5, `${metric.basis} vs ${imperial.basis}`);
});

test('в каждом слоте не больше одной вещи, кроме аксессуаров', () => {
  for (const t of [-30, -15, -5, 3, 10, 17, 23, 30]) {
    const o = pickOutfit({ temp: t, uv: 7, precipProb: 80, wind: 35 });
    for (const slot of ['outer', 'mid', 'legs', 'head', 'shoes']) {
      assert.ok(slots(o, slot).length <= 1, `${t} °C: слот ${slot} задублирован`);
    }
    assert.ok(o.advice.length > 0);
    assert.ok(o.palette.outer.startsWith('#'));
  }
});

/* ------------------------------------------------------------------ */
/*  Индекс автомойки                                                   */
/* ------------------------------------------------------------------ */

test('сухие трое суток — отличный день для мойки', () => {
  const r = carWashIndex([
    { date: '1', precipProbMax: 0, precipSum: 0 },
    { date: '2', precipProbMax: 5, precipSum: 0 },
    { date: '3', precipProbMax: 10, precipSum: 0 },
  ]);
  assert.equal(r.level, 'great');
  assert.match(r.verdict, /Отличный день/);
});

test('ливень завтра важнее ливня послезавтра', () => {
  const tomorrow = carWashIndex([
    { date: '1', precipProbMax: 0, precipSum: 0 },
    { date: '2', precipProbMax: 95, precipSum: 12 },
    { date: '3', precipProbMax: 0, precipSum: 0 },
  ]);
  const later = carWashIndex([
    { date: '1', precipProbMax: 0, precipSum: 0 },
    { date: '2', precipProbMax: 0, precipSum: 0 },
    { date: '3', precipProbMax: 95, precipSum: 12 },
  ]);
  assert.ok(tomorrow.score < later.score, `${tomorrow.score} должно быть ниже ${later.score}`);
  assert.match(tomorrow.verdict, /завтра/);
});

test('пустой прогноз не роняет расчёт', () => {
  const r = carWashIndex([]);
  assert.equal(r.verdict, 'Нет данных');
});

/* ------------------------------------------------------------------ */
/*  Индекс сушки белья                                                 */
/* ------------------------------------------------------------------ */

test('эталонные условия дают около трёх часов', () => {
  const r = laundryIndex({ temp: 20, humidity: 50, wind: 7.2 }); // 2 м/с
  assert.match(r.detail, /около 3/);
  assert.ok(r.score >= 65, `score ${r.score}`);
});

test('жара с ветром сушит быстрее, чем сырая прохлада', () => {
  const fast = laundryIndex({ temp: 30, humidity: 25, wind: 20 });
  const slow = laundryIndex({ temp: 8, humidity: 88, wind: 2 });
  assert.ok(fast.score > slow.score);
  assert.ok(['great', 'good'].includes(fast.level));
});

test('насыщенный воздух и дождь — сушить бесполезно', () => {
  const r = laundryIndex({ temp: 14, humidity: 97, wind: 3 });
  assert.equal(r.level, 'bad');
  assert.match(r.verdict, /бесполезно/);

  const rainy = laundryIndex({ temp: 18, humidity: 60, wind: 10, precipProb: 80 });
  assert.equal(rainy.level, 'bad');
});

test('мороз замедляет сушку, но не запрещает её', () => {
  const r = laundryIndex({ temp: -6, humidity: 70, wind: 10 });
  assert.notEqual(r.level, 'bad');
  assert.ok(r.notes.some((n) => /вымораживанием/.test(n)));
});

/* ------------------------------------------------------------------ */
/*  Индекс выгула питомцев                                             */
/* ------------------------------------------------------------------ */

test('асфальт нагревается сильнее воздуха только днём', () => {
  assert.ok(pavementTemp(25, 9, true) > 45);
  assert.equal(pavementTemp(25, 9, false), 27);
});

test('летний полдень — опасность ожога лап', () => {
  const r = petWalkIndex({ temp: 30, uv: 9, isDay: true });
  assert.equal(r.level, 'bad');
  assert.match(r.verdict, /обжигает/);
  assert.ok(r.notes.some((n) => /тени|утра/.test(n)));
});

test('та же жара ночью безопасна', () => {
  const r = petWalkIndex({ temp: 24, uv: 0, isDay: false });
  assert.ok(r.score > 60, `score ${r.score}`);
});

test('критический мороз', () => {
  const r = petWalkIndex({ temp: -25, feelsLike: -31, isDay: true });
  assert.equal(r.level, 'bad');
  assert.match(r.verdict, /мороз/);
});

test('околонулевая температура — предупреждение о реагентах', () => {
  const r = petWalkIndex({ temp: -2, isDay: true, uv: 1 });
  assert.ok(r.notes.some((n) => /реагент/i.test(n)), r.notes.join(' | '));
});

test('индексы всегда возвращают заполненный результат', () => {
  for (const t of [-30, -10, 0, 15, 25, 35]) {
    const r = petWalkIndex({ temp: t, uv: 5, isDay: true });
    assert.ok(r.score >= 0 && r.score <= 100);
    assert.ok(r.verdict.length > 0 && r.detail.length > 0 && r.notes.length > 0);
  }
});

/* ------------------------------------------------------------------ */
/*  Города                                                             */
/* ------------------------------------------------------------------ */

test('список городов собран без дублей по координатам', () => {
  const seen = new Set();
  for (const c of WORLD_CITIES) {
    const k = `${c.lat.toFixed(1)}:${c.lon.toFixed(1)}`;
    assert.ok(!seen.has(k), `дубль координат: ${c.name}`);
    seen.add(k);
  }
  assert.ok(CITY_COUNT.capitals > 100, `столиц ${CITY_COUNT.capitals}`);
  assert.ok(CITY_COUNT.metros > 40, `мегаполисов ${CITY_COUNT.metros}`);
});

test('координаты городов в допустимых пределах', () => {
  for (const c of WORLD_CITIES) {
    assert.ok(c.lat >= -90 && c.lat <= 90, `${c.name}: широта ${c.lat}`);
    assert.ok(c.lon >= -180 && c.lon <= 180, `${c.name}: долгота ${c.lon}`);
    assert.ok(c.name.length > 0 && c.country.length > 0);
  }
});
