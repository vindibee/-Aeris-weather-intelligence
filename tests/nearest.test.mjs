/**
 * Тесты расширяющегося поиска (server/src/lib/nearest.js).
 *
 * Живые провайдеры почти всегда что-то возвращают даже посреди океана, поэтому
 * «пустую» точку воспроизводим синтетическим зондом — иначе поведение fallback
 * никак не проверить.
 *
 *   node tests/nearest.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findNearestWithData,
  haversineKm,
  offsetPoint,
  fallbackInfo,
} from '../server/src/lib/nearest.js';

const KYIV = { lat: 50.4547, lon: 30.5238 };

test('haversineKm считает известные расстояния', () => {
  const london = { lat: 51.5074, lon: -0.1278 };
  const d = haversineKm(KYIV.lat, KYIV.lon, london.lat, london.lon);
  // справочное расстояние Киев — Лондон около 2130 км
  assert.ok(Math.abs(d - 2130) < 40, `ожидали ~2130 км, получили ${Math.round(d)}`);
  assert.equal(Math.round(haversineKm(KYIV.lat, KYIV.lon, KYIV.lat, KYIV.lon)), 0);
});

test('offsetPoint отходит ровно на заданное расстояние', () => {
  for (const bearing of [0, 90, 180, 270]) {
    const p = offsetPoint(KYIV.lat, KYIV.lon, 150, bearing);
    const back = haversineKm(KYIV.lat, KYIV.lon, p.lat, p.lon);
    assert.ok(Math.abs(back - 150) < 1, `азимут ${bearing}: получили ${back.toFixed(1)} км`);
  }
});

test('offsetPoint заворачивает долготу через антимеридиан', () => {
  const p = offsetPoint(0, 179.9, 100, 90);
  assert.ok(p.lon >= -180 && p.lon <= 180, `долгота вне диапазона: ${p.lon}`);
  assert.ok(p.lon < 0, 'ожидали переход в западное полушарие');
});

test('данные в самой точке — расширения не происходит', async () => {
  let calls = 0;
  const res = await findNearestWithData(KYIV.lat, KYIV.lon, async (p) => {
    calls++;
    return { temp: 12, at: p };
  });
  assert.equal(calls, 1, 'лишние запросы при данных в исходной точке');
  assert.equal(res.expanded, false);
  assert.equal(res.distanceKm, 0);
  assert.equal(res.data.temp, 12);
  assert.equal(fallbackInfo(res, KYIV), null, 'без расширения fallback не описываем');
});

test('пустая зона вокруг точки — поиск расширяется до ближайших данных', async () => {
  const DEAD_RADIUS_KM = 100;
  const probe = async (p) =>
    haversineKm(KYIV.lat, KYIV.lon, p.lat, p.lon) < DEAD_RADIUS_KM
      ? null
      : { temp: 7, at: p };

  const res = await findNearestWithData(KYIV.lat, KYIV.lon, probe);
  assert.ok(res, 'данные должны были найтись за пределами мёртвой зоны');
  assert.equal(res.expanded, true);
  assert.ok(res.distanceKm >= DEAD_RADIUS_KM, `нашли внутри мёртвой зоны: ${res.distanceKm} км`);
  // кольца 0/25/60 пустые, значит сработать должно кольцо 150 км
  assert.equal(res.distanceKm, 150);
  assert.equal(res.ringsTried, 4);

  const info = fallbackInfo(res, KYIV);
  assert.equal(info.expanded, true);
  assert.equal(info.distanceKm, 150);
  assert.deepEqual(info.requested, KYIV);
  assert.ok(info.reason.length > 0);
});

test('в кольце выбирается геометрически ближайшая точка', async () => {
  // данные есть только к северу — на кольце это одна точка из восьми
  const probe = async (p) => (p.lat > KYIV.lat + 0.5 ? { at: p } : null);
  const res = await findNearestWithData(KYIV.lat, KYIV.lon, probe);
  assert.ok(res.data.at.lat > KYIV.lat, 'ожидали точку севернее исходной');
  assert.ok(res.distanceKm <= 150);
});

test('исключения в зонде считаются как «нет данных», а не роняют поиск', async () => {
  let attempts = 0;
  const probe = async (p) => {
    attempts++;
    if (attempts <= 9) throw new Error('провайдер недоступен');
    return { at: p };
  };
  const res = await findNearestWithData(KYIV.lat, KYIV.lon, probe);
  assert.ok(res, 'поиск должен пережить падения зонда');
});

test('данных нет нигде — возвращается null, а не исключение', async () => {
  const res = await findNearestWithData(KYIV.lat, KYIV.lon, async () => null);
  assert.equal(res, null);
});

test('кольца можно сузить через опции', async () => {
  const probe = async (p) => (haversineKm(KYIV.lat, KYIV.lon, p.lat, p.lon) > 5 ? { at: p } : null);
  const res = await findNearestWithData(KYIV.lat, KYIV.lon, probe, {
    rings: [0, 10],
    bearings: [0, 180],
  });
  assert.equal(res.distanceKm, 10);
  assert.equal(res.ringsTried, 2);
});
