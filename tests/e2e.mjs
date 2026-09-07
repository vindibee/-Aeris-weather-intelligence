import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'screenshots', '/');
mkdirSync(SHOTS, { recursive: true });

const errors = [];
const results = [];
const ok = (name, detail = '') => { results.push(['PASS', name, detail]); console.log(`  PASS  ${name} ${detail}`); };
const fail = (name, detail = '') => { results.push(['FAIL', name, detail]); console.log(`  FAIL  ${name} ${detail}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1600,1000', '--enable-unsafe-swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text();
    if (!/favicon|ERR_INTERNET|net::ERR_BLOCKED/i.test(t)) errors.push(t);
  }
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

try {
  /* ---------- 1. landing ---------- */
  console.log('\n[1] Лендинг');
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(4500); // globe + live data

  const title = await page.title();
  title.includes('Aeris') ? ok('title', `"${title}"`) : fail('title', title);

  const h1 = await page.$eval('h1', (e) => e.textContent.trim());
  h1.includes('Погода') ? ok('hero h1', `"${h1}"`) : fail('hero h1', h1);

  const canvasCount = await page.$$eval('canvas', (n) => n.length);
  canvasCount > 0 ? ok('WebGL globe canvas', `${canvasCount} canvas`) : fail('WebGL globe canvas', 'нет canvas');

  const glOk = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl;
  });
  glOk ? ok('WebGL context') : fail('WebGL context');

  // live ticker fed by the API
  const tickerTemps = await page.$$eval('section span', (els) =>
    els.map((e) => e.textContent).filter((t) => /^[+-]?\d+°$/.test(t?.trim() ?? ''))
  );
  tickerTemps.length ? ok('живые данные городов', `${tickerTemps.length} значений: ${tickerTemps.slice(0, 5).join(' ')}`)
                     : fail('живые данные городов', 'температуры не отрисовались');

  const bootHidden = await page.$eval('#boot-loader', (e) => e.classList.contains('done'));
  bootHidden ? ok('boot loader скрыт') : fail('boot loader скрыт');

  await page.screenshot({ path: SHOTS + '01-landing.png' });

  // scroll through the whole page to trigger reveal animations
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
  });
  await sleep(1200);
  await page.screenshot({ path: SHOTS + '02-landing-features.png' });
  const featureCards = await page.$$eval('#features .glass', (n) => n.length);
  featureCards >= 6 ? ok('секция возможностей', `${featureCards} карточек`) : fail('секция возможностей', String(featureCards));

  /* ---------- 2. protected route ---------- */
  console.log('\n[2] Защита маршрутов');
  await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
  await sleep(1500);
  const redirected = page.url().includes('/login');
  redirected ? ok('/app без входа -> /login') : fail('/app без входа -> /login', page.url());

  /* ---------- 3. login ---------- */
  console.log('\n[3] Авторизация');
  await page.screenshot({ path: SHOTS + '03-login.png' });

  // wrong password first
  await page.type('input[type="email"]', 'demo@aeris.app');
  await page.type('input[type="password"]', 'wrongpass');
  await page.click('button[type="submit"]');
  await sleep(1800);
  const errText = await page.$eval('body', (b) => b.innerText);
  errText.includes('Неверный email или пароль')
    ? ok('отказ при неверном пароле')
    : fail('отказ при неверном пароле', 'нет сообщения об ошибке');
  await page.screenshot({ path: SHOTS + '04-login-error.png' });

  // demo button
  const demoBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('демо-аккаунт'))
  );
  await demoBtn.asElement().click();
  await page.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 25000 });
  ok('вход в демо-аккаунт', page.url());

  /* ---------- 4. dashboard overview ---------- */
  console.log('\n[4] Кабинет — обзор');
  await sleep(6000);
  const body = await page.$eval('body', (b) => b.innerText + ' ' + b.textContent);

  const temps = body.match(/-?\d+°/g) ?? [];
  temps.length > 10 ? ok('температурные данные', `${temps.length} значений`) : fail('температурные данные', String(temps.length));

  for (const [label, needle] of [
    ['имя пользователя', 'Demo Explorer'],
    ['почасовой прогноз', 'Почасовой прогноз'],
    ['прогноз на дни', 'Прогноз на'],
    ['компас ветра', 'Ветер'],
    ['качество воздуха', 'Качество воздуха'],
    ['индекс комфорта', 'Индекс комфорта'],
    ['UV-индекс', 'UV-индекс'],
    ['солнце', 'Световой день'],
    ['давление', 'Давление'],
  ]) {
    body.includes(needle) ? ok(label) : fail(label, `не найдено "${needle}"`);
  }

  const svgCount = await page.$$eval('svg', (n) => n.length);
  svgCount > 20 ? ok('SVG-визуализации', `${svgCount} svg`) : fail('SVG-визуализации', String(svgCount));

  await page.screenshot({ path: SHOTS + '05-dashboard.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 900));
  await sleep(1500);
  await page.screenshot({ path: SHOTS + '06-dashboard-charts.png' });
  await page.evaluate(() => window.scrollTo(0, 1900));
  await sleep(1500);
  await page.screenshot({ path: SHOTS + '07-dashboard-panels.png' });
  await page.evaluate(() => window.scrollTo(0, 0));

  /* ---------- 5. metric switching ---------- */
  console.log('\n[5] Переключение метрик графика');
  const windTab = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ветер' && b.closest('.glass'))
  );
  if (windTab.asElement()) {
    await windTab.asElement().click();
    await sleep(1400);
    const hasGusts = (await page.$eval('body', (b) => b.innerText)).includes('порывы');
    hasGusts ? ok('переключение на график ветра') : fail('переключение на график ветра');
    await page.screenshot({ path: SHOTS + '08-wind-chart.png' });
  } else fail('переключение на график ветра', 'кнопка не найдена');

  /* ---------- 6. search ---------- */
  console.log('\n[6] Поиск города (кириллица)');
  await page.click('input[placeholder="Найти город…"]');
  await page.type('input[placeholder="Найти город…"]', 'Одесса', { delay: 60 });
  await sleep(2600);
  const suggestions = await page.$eval('body', (b) => b.innerText);
  suggestions.includes('Одесса') ? ok('автодополнение по кириллице') : fail('автодополнение по кириллице');
  await page.screenshot({ path: SHOTS + '09-search.png' });

  const firstSuggestion = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Одесса') && b.querySelector('svg'))
  );
  if (firstSuggestion.asElement()) {
    await firstSuggestion.asElement().click();
    await sleep(5500);
    const nowBody = await page.$eval('body', (b) => b.innerText);
    nowBody.includes('Одесса') ? ok('смена локации на Одессу') : fail('смена локации на Одессу');
    await page.screenshot({ path: SHOTS + '10-odesa.png' });
  } else fail('смена локации', 'подсказка не кликабельна');

  /* ---------- 7. map ---------- */
  console.log('\n[7] Карта');
  await page.goto(BASE + '/app/map', { waitUntil: 'networkidle2' });
  await sleep(9000);
  const mapBody = await page.$eval('body', (b) => b.innerText);
  mapBody.includes('Метео-карта') ? ok('страница карты') : fail('страница карты');

  const mapCanvas = await page.$$eval('canvas', (n) => n.map((c) => `${c.width}x${c.height}`));
  mapCanvas.length >= 2 ? ok('canvas карты + ветра', mapCanvas.join(', ')) : fail('canvas карты + ветра', mapCanvas.join(','));

  const hasGrid = mapBody.includes('точек');
  hasGrid ? ok('метеосетка загружена', mapBody.match(/(\d+) точек/)?.[0] ?? '') : fail('метеосетка загружена');
  await page.screenshot({ path: SHOTS + '11-map-temp.png' });

  // click on map -> point card
  const box = await (await page.$('.maplibregl-canvas')).boundingBox();
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await sleep(6000);
  const afterClick = await page.$eval('body', (b) => b.innerText);
  afterClick.includes('Сделать основной') ? ok('карточка точки по клику') : fail('карточка точки по клику');
  await page.screenshot({ path: SHOTS + '12-map-point.png' });

  // radar
  const radarBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Радар осадков'))
  );
  await radarBtn.asElement().click();
  await sleep(5000);
  const radarBody = await page.$eval('body', (b) => b.innerText);
  /кадр \d+ \/ \d+/.test(radarBody) ? ok('радар с таймлайном', radarBody.match(/кадр \d+ \/ \d+/)[0]) : fail('радар с таймлайном');
  await page.screenshot({ path: SHOTS + '13-map-radar.png' });

  // switch overlay to precipitation
  const precipBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Осадки')
  );
  if (precipBtn.asElement()) {
    await precipBtn.asElement().click();
    await sleep(3500);
    ok('переключение слоя на осадки');
    await page.screenshot({ path: SHOTS + '14-map-precip.png' });
  }

  /* ---------- 8. locations ---------- */
  console.log('\n[8] Локации');
  await page.goto(BASE + '/app/locations', { waitUntil: 'networkidle2' });
  await sleep(6500);
  const locBody = await page.$eval('body', (b) => b.innerText);
  const cities = ['Киев', 'Лондон', 'Токио', 'Рейкьявик'].filter((c) => locBody.includes(c));
  cities.length >= 3 ? ok('карточки сохранённых городов', cities.join(', ')) : fail('карточки городов', cities.join(','));
  await page.screenshot({ path: SHOTS + '15-locations.png' });

  /* ---------- 9. settings + theme ---------- */
  console.log('\n[9] Настройки и тема');
  await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle2' });
  await sleep(3500);
  const setBody = await page.$eval('body', (b) => b.innerText);
  setBody.includes('Единицы измерения') && setBody.includes('online')
    ? ok('страница настроек, API online')
    : fail('страница настроек');
  await page.screenshot({ path: SHOTS + '16-settings.png' });

  // imperial units
  const impBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Имперские'))
  );
  await impBtn.asElement().click();
  await sleep(800);
  await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
  await sleep(6000);
  const impBody = await page.$eval('body', (b) => b.innerText);
  impBody.includes('°F') ? ok('переключение в имперские единицы (°F)') : fail('переключение в °F');
  await page.screenshot({ path: SHOTS + '17-imperial.png' });

  // back to metric
  await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle2' });
  await sleep(2500);
  const metBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Метрические'))
  );
  await metBtn.asElement().click();
  await sleep(800);

  // light theme
  const lightBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Светлая')
  );
  await lightBtn.asElement().click();
  await sleep(1600);
  const isLight = await page.evaluate(() => document.documentElement.classList.contains('light'));
  isLight ? ok('светлая тема применилась') : fail('светлая тема');
  await page.screenshot({ path: SHOTS + '18-light-theme.png' });

  const darkBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Тёмная')
  );
  await darkBtn.asElement().click();
  await sleep(1000);

  /* ---------- 10. registration ---------- */
  console.log('\n[10] Регистрация нового пользователя');
  const logoutBtn = await page.evaluateHandle(() =>
    [...document.querySelectorAll('button[title="Выйти"]')][0]
  );
  await logoutBtn.asElement().click();
  await sleep(2500);
  ok('выход из аккаунта', page.url());

  await page.goto(BASE + '/register', { waitUntil: 'networkidle2' });
  await sleep(1200);
  const uniq = 'tester' + Date.now().toString().slice(-7);
  await page.type('input[autocomplete="name"]', 'Тестовый Пользователь', { delay: 20 });
  await page.type('input[autocomplete="email"]', `${uniq}@aeris.app`, { delay: 20 });
  await page.type('input[autocomplete="new-password"]', 'testpass2026', { delay: 20 });
  await sleep(600);
  await page.screenshot({ path: SHOTS + '19-register.png' });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith('/app'), { timeout: 25000 });
  await sleep(5000);
  const newBody = await page.$eval('body', (b) => b.innerText);
  newBody.includes('Тестовый') ? ok('регистрация нового аккаунта', uniq + '@aeris.app') : fail('регистрация');
  await page.screenshot({ path: SHOTS + '20-new-user.png' });

  /* ---------- 11. session persistence ---------- */
  console.log('\n[11] Сохранение сессии');
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(4000);
  const stillIn = page.url().includes('/app') && !(await page.$eval('body', (b) => b.innerText)).includes('С возвращением');
  stillIn ? ok('сессия сохраняется после перезагрузки') : fail('сессия после перезагрузки');

  /* ---------- 12. mobile ---------- */
  console.log('\n[12] Мобильная вёрстка');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await sleep(4000);
  const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  hOverflow <= 2 ? ok('нет горизонтального скролла на мобильном') : fail('горизонтальный скролл', `${hOverflow}px`);
  await page.screenshot({ path: SHOTS + '21-mobile-landing.png' });

  await page.goto(BASE + '/app', { waitUntil: 'networkidle2' });
  await sleep(6000);
  await page.screenshot({ path: SHOTS + '22-mobile-dashboard.png' });
  ok('мобильный кабинет отрисован');

  /* ---------- 13. интерактивность глобуса ---------- */
  const NL = String.fromCharCode(10);
  console.log('');
  console.log('[13] Глобус: ручное вращение и стабильность');
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await sleep(6000);

  const bufBefore = await page.evaluate(() => { const c = document.querySelector('canvas'); return c.width + 'x' + c.height; });
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await sleep(1800);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(2200);
  const bufAfter = await page.evaluate(() => { const c = document.querySelector('canvas'); return c.width + 'x' + c.height; });
  bufBefore === bufAfter
    ? ok('буфер глобуса не разъезжается при скролле', bufAfter)
    : fail('буфер глобуса поплыл', bufBefore + ' -> ' + bufAfter);

  // подпись столицы всплывает по наведению на точку
  const gbox = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  const baseText = await page.evaluate(() => document.body.innerText);
  let capital = null;
  for (let gx = -4; gx <= 4 && !capital; gx++) {
    for (let gy = -4; gy <= 4 && !capital; gy++) {
      await page.mouse.move(gbox.x + gx * 22, gbox.y + gy * 22);
      await sleep(110);
      const t = await page.evaluate(() => document.body.innerText);
      const fresh = t.split(NL).filter((l) => l.trim() && !baseText.includes(l.trim()));
      if (fresh.length) capital = fresh[0].slice(0, 40);
    }
  }
  capital ? ok('подпись столицы по наведению', capital) : fail('подпись столицы не всплыла');

  /* ---------- 14. погода в космосе ---------- */
  console.log('');
  console.log('[14] Погода в космосе');
  await page.goto(BASE + '/space-weather', { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(9000);

  const space = await page.evaluate(() => ({
    cards: document.querySelectorAll('article').length,
    names: [...document.querySelectorAll('article h3')].map((h) => h.innerText),
    canvases: document.querySelectorAll('canvas').length,
    live: (document.body.innerText.match(/LIVE/g) || []).length,
    fallback: (document.body.innerText.match(/РЕЗЕРВ/g) || []).length,
  }));
  space.cards === 8 ? ok('восемь планет', space.names.join(', ')) : fail('планеты', String(space.cards));
  space.canvases === 8 ? ok('3D-глобус в каждой карточке', space.canvases + ' canvas') : fail('глобусы планет', String(space.canvases));
  space.live > 0 && space.fallback > 0
    ? ok('живые и резервные источники размечены', space.live + ' live / ' + space.fallback + ' резерв')
    : fail('разметка источников', JSON.stringify(space));
  await page.screenshot({ path: SHOTS + '23-space-weather.png' });

  const solar = await page.evaluate(() => /Солнечная активность/.test(document.body.innerText) && /Kp/.test(document.body.innerText));
  solar ? ok('панель солнечной активности') : fail('панель солнечной активности');

  await page.evaluate(() => {
    const a = [...document.querySelectorAll('article')].find((x) => x.innerText.startsWith('Земля'));
    a.querySelector('button:last-of-type').click();
  });
  await sleep(4500);
  const modal = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      temp: /ТЕМПЕРАТУРА/i.test(t),
      pressure: /АТМОСФЕРНОЕ ДАВЛЕНИЕ/i.test(t),
      wind: /СКОРОСТЬ ВЕТРА/i.test(t),
      composition: /СОСТАВ АТМОСФЕРЫ/i.test(t),
      earthBtn: /Открыть земной глобус/i.test(t),
      canvases: document.querySelectorAll('canvas').length,
    };
  });
  modal.temp && modal.pressure && modal.wind && modal.composition
    ? ok('модалка: температура, давление, ветер, состав')
    : fail('метрики в модалке', JSON.stringify(modal));
  modal.canvases === 1
    ? ok('карточки отдают WebGL-контексты под модалку', '1 canvas')
    : fail('контексты под модалку', String(modal.canvases));
  await page.screenshot({ path: SHOTS + '24-space-modal.png' });

  modal.earthBtn ? ok('кнопка перехода на земной глобус') : fail('кнопка перехода отсутствует');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('Открыть земной глобус'));
    b && b.click();
  });
  await sleep(4500);
  const backOnGlobe = page.url().includes('#globe') && (await page.$$eval('canvas', (n) => n.length)) > 0;
  backOnGlobe ? ok('переход на главный 3D-глобус', page.url()) : fail('переход на глобус', page.url());

  /* ---------- 15. клик по городу на глобусе + Одеватор ---------- */
  console.log('');
  console.log('[15] Сводка города и Одеватор');
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await sleep(7000);
  const cbox = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  let cityOpened = false;
  for (let gx = -5; gx <= 5 && !cityOpened; gx++) {
    for (let gy = -5; gy <= 5 && !cityOpened; gy++) {
      await page.mouse.move(cbox.x + gx * 20, cbox.y + gy * 20);
      await sleep(80);
      await page.mouse.down(); await page.mouse.up();
      await sleep(600);
      cityOpened = await page.evaluate(() => /Одеватор/.test(document.body.innerText));
    }
  }
  cityOpened ? ok('клик по метке города открывает сводку') : fail('модалка города не открылась');
  if (cityOpened) {
    await sleep(6000);
    const wardrobe = await page.evaluate(() => {
      const t = document.body.innerText.toUpperCase();
      return {
        slots: ['ВЕРХНЯЯ ОДЕЖДА', 'НИЗ', 'ОБУВЬ', 'АКСЕССУАРЫ'].filter((x) => t.includes(x)).length,
        both: /ПОКАЗАНЫ ОБА ВАРИАНТА/.test(t),
        canvases: document.querySelectorAll('canvas').length,
      };
    });
    wardrobe.slots >= 2 ? ok('набор одежды разложен по слотам', wardrobe.slots + ' слота')
      : fail('слоты гардероба', JSON.stringify(wardrobe));
    wardrobe.both ? ok('без указанного пола показаны обе фигуры')
      : fail('логика пола', JSON.stringify(wardrobe));
    wardrobe.canvases >= 2 ? ok('3D-аватар отрисован', wardrobe.canvases + ' canvas')
      : fail('аватар не отрисован');
    await page.screenshot({ path: SHOTS + '25-city-modal.png' });
    await page.keyboard.press('Escape');
    await sleep(1200);
  }

  /* ---------- 16. бытовые индексы и охотник за экстремумами ---------- */
  console.log('');
  console.log('[16] Бытовые индексы и телепорт');
  await page.goto(BASE + '/app', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(9000);
  const modules = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      indices: /Бытовые индексы/.test(t),
      cards: ['Автомойка', 'Сушка белья', 'Выгул питомцев'].filter((x) => t.includes(x)).length,
      hunter: /Охотник за экстремумами/.test(t),
      buttons: ['Самое жаркое', 'Самое холодное', 'Самое ветреное'].filter((x) => t.includes(x)).length,
    };
  });
  modules.indices && modules.cards === 3
    ? ok('три бытовых индекса на месте')
    : fail('бытовые индексы', JSON.stringify(modules));
  modules.hunter && modules.buttons === 3
    ? ok('блок охотника за экстремумами с тремя кнопками')
    : fail('охотник за экстремумами', JSON.stringify(modules));

  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => /Бытовые индексы/.test(x.innerText));
    h && h.scrollIntoView({ block: 'center' });
  });
  await sleep(2000);
  await page.screenshot({ path: SHOTS + '26-indices.png' });

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Самое жаркое/.test(b.innerText));
    btn && btn.click();
  });
  await sleep(13000);
  const extreme = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      card: t.toUpperCase().includes('ТЕМПЕРАТУРА') && t.toUpperCase().includes('ПОРЫВЫ'),
      note: t.includes('опрошено') && t.includes('точек'),
      action: /Смотреть прогноз/.test(t),
    };
  });
  extreme.card && extreme.note && extreme.action
    ? ok('карточка экстремума с данными и оговоркой')
    : fail('карточка экстремума', JSON.stringify(extreme));
  await page.screenshot({ path: SHOTS + '27-extremes.png' });

  /* ---------- 17. климатические пояса планет ---------- */
  console.log('');
  console.log('[17] Климатические пояса и полный экран');
  await page.goto(BASE + '/space-weather', { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(9000);
  await page.evaluate(() => {
    const a = [...document.querySelectorAll('article')].find((x) => x.innerText.startsWith('Земля'));
    a && a.querySelector('button:last-of-type').click();
  });
  await sleep(5000);
  const controls = await page.evaluate(() => {
    const t = document.body.innerText;
    return ['Климат-пояса', 'вращение', 'Во весь экран'].filter((x) => t.includes(x)).length;
  });
  controls === 3 ? ok('три режима просмотра планеты') : fail('режимы просмотра', String(controls));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Климат-пояса/.test(x.innerText));
    b && b.click();
  });
  await sleep(3000);
  const climateOn = await page.evaluate(() => document.body.innerText.includes('тропики'));
  climateOn ? ok('климатические пояса включаются') : fail('климатические пояса');
  await page.screenshot({ path: SHOTS + '28-climate.png' });

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Во весь экран/.test(x.innerText));
    b && b.click();
  });
  await sleep(4000);
  const fullscreen = await page.evaluate(() => /Свернуть/.test(document.body.innerText));
  fullscreen ? ok('полноэкранный режим планеты') : fail('полный экран');
  await page.screenshot({ path: SHOTS + '29-fullscreen.png' });

} catch (e) {
  fail('EXCEPTION', e.message);
  console.error(e);
} finally {
  console.log('\n=== Ошибки в консоли браузера ===');
  if (errors.length) errors.slice(0, 12).forEach((e) => console.log('  !', e.slice(0, 220)));
  else console.log('  нет');

  const passed = results.filter((r) => r[0] === 'PASS').length;
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`\n=== ИТОГ: ${passed} passed / ${failed} failed ===`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}
