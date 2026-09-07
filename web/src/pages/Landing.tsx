import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import {
  Wind, Droplets, Thermometer, Map as MapIcon, Radar, Gauge, Sun, Snowflake,
  ArrowRight, Github, Zap, Globe2, LineChart, Layers, ShieldCheck, Sparkles, Rocket,
} from 'lucide-react';
import { Aurora } from '../components/Atmosphere';
import { GlassCard, SectionTitle, Stat, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { codeEmoji, tempColor } from '../lib/weather';
import type { GlobeMarker } from '../components/Globe3D';
import type { WorldCity } from '../lib/cities';
import CityWeatherModal, { type ModalCity } from '../components/weather/CityWeatherModal';

const Globe3D = lazy(() => import('../components/Globe3D'));

const SHOWCASE = [
  { name: 'Киев', lat: 50.4547, lon: 30.5238 },
  { name: 'Лондон', lat: 51.5074, lon: -0.1278 },
  { name: 'Нью-Йорк', lat: 40.7143, lon: -74.006 },
  { name: 'Токио', lat: 35.6895, lon: 139.6917 },
  { name: 'Дубай', lat: 25.2048, lon: 55.2708 },
  { name: 'Сидней', lat: -33.8688, lon: 151.2093 },
  { name: 'Рейкьявик', lat: 64.1355, lon: -21.8954 },
  { name: 'Сан-Паулу', lat: -23.5505, lon: -46.6333 },
];

const FEATURES = [
  {
    icon: MapIcon, color: '#7df2ff',
    title: 'Интерактивная метео-карта',
    text: 'MapLibre GL с векторными слоями: температура, ветер, облачность и давление. Плавный зум, клик по любой точке — мгновенный прогноз.',
  },
  {
    icon: Wind, color: '#a78bfa',
    title: 'Живые потоки ветра',
    text: 'Тысячи частиц рисуют реальное поле ветра на canvas поверх карты — направление и скорость видно буквально глазами.',
  },
  {
    icon: Radar, color: '#f472b6',
    title: 'Радар осадков',
    text: 'Анимация радарных снимков RainViewer за последние 2 часа с таймлайном и авто-проигрыванием кадров.',
  },
  {
    icon: LineChart, color: '#4ade80',
    title: 'Почасовая аналитика',
    text: 'Графики температуры, ощущаемой, вероятности осадков, давления и порывов на 16 суток вперёд.',
  },
  {
    icon: Gauge, color: '#fbbf24',
    title: 'Полный набор метрик',
    text: 'UV-индекс, качество воздуха (PM2.5, PM10, NO₂, O₃), точка росы, видимость, CAPE, длина светового дня.',
  },
  {
    icon: Layers, color: '#38bdf8',
    title: 'Ваши локации',
    text: 'Сохраняйте города, сравнивайте их бок о бок и переключайтесь одним кликом. Всё синхронизируется с аккаунтом.',
  },
];

const STEPS = [
  { n: '01', title: 'Создайте аккаунт', text: 'Регистрация за 15 секунд. Или войдите в демо-профиль одной кнопкой.' },
  { n: '02', title: 'Выберите точку', text: 'Поиск по городу, геолокация браузера или клик прямо по глобусу и карте.' },
  { n: '03', title: 'Наблюдайте', text: 'Кабинет собирает 20+ параметров в живые визуализации и обновляет их автоматически.' },
];

function useLiveCities() {
  const [data, setData] = useState<{ name: string; lat: number; lon: number; temp: number; code: number; wind: number; isDay: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.bulk(SHOWCASE, 'metric')
      .then((res) => {
        if (!alive) return;
        setData(
          res.points.map((p: any, i: number) => ({
            name: SHOWCASE[i].name, lat: SHOWCASE[i].lat, lon: SHOWCASE[i].lon,
            temp: Math.round(p.current?.temperature_2m ?? 0),
            code: p.current?.weather_code ?? 0,
            wind: Math.round(p.current?.wind_speed_10m ?? 0),
            isDay: p.current?.is_day ?? 1,
          }))
        );
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return { data, loading };
}

/* ------------------------------------------------------------------ */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? 'py-3' : 'py-5'
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-5 py-3 transition-all duration-500 sm:px-7 ${
          scrolled ? 'glass-strong mx-4 shadow-card' : 'mx-4 border border-transparent'
        }`}
      >
        <Link to="/" className="group flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-aqua-400 to-violet-500 shadow-glow">
            <Sun className="text-ink-950" size={20} strokeWidth={2.6} />
            <span className="absolute inset-0 rounded-xl bg-aqua-400/40 blur-md transition group-hover:blur-lg" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight">Aeris</div>
            <div className="hidden text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)] sm:block">weather intelligence</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--text-dim)] md:flex">
          {[['Возможности', '#features'], ['Как работает', '#how'], ['Данные', '#data']].map(([label, href]) => (
            <a key={href} href={href} className="relative transition hover:text-[var(--text)]">
              {label}
            </a>
          ))}
          <Link
            to="/space-weather"
            className="relative flex items-center gap-1.5 transition hover:text-violet-300"
          >
            <Rocket size={14} />
            Погода в космосе
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--text-dim)] transition hover:text-[var(--text)]"
          >
            Войти
          </Link>
          <Link
            to="/register"
            className="group relative overflow-hidden rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-5 py-2.5 text-sm font-bold text-ink-950 shadow-glow transition hover:scale-[1.03] active:scale-95"
          >
            <span className="relative z-10">Начать</span>
          </Link>
        </div>
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */

function Hero({ markers, loading, onCity }: {
  markers: GlobeMarker[];
  loading: boolean;
  onCity: (c: ModalCity) => void;
}) {
  // Зум включаем только после того, как пользователь сам взялся за глобус:
  // иначе колесо мыши зумило бы вместо прокрутки страницы.
  const [zoomable, setZoomable] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  // Один общий источник для параллакса текста: раньше y шёл через мягкую
  // пружину, а opacity/scale — напрямую, и после скролла блок ещё секунду
  // «догонял» сам себя. Теперь и сдвиг, и прозрачность идут от одной величины.
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const y = useTransform(progress, [0, 1], [0, 120]);
  const opacity = useTransform(progress, [0, 0.75], [1, 0]);

  return (
    <section ref={ref} id="globe" className="relative min-h-[92svh] overflow-hidden pt-28 sm:pt-32">
      <div className="relative z-20 mx-auto grid max-w-7xl items-center gap-6 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* ---- copy ---- */}
        <motion.div style={{ y, opacity }} className="relative z-20 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-aqua-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aqua-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-aqua-400" />
            </span>
            {loading ? 'Подключаемся к метеосети…' : 'Данные обновлены только что'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-balance text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"
          >
            Погода, которую <span className="text-gradient">видно</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.9 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-[var(--text-dim)] sm:text-lg lg:mx-0"
          >
            Интерактивная метеоплатформа: живые карты ветра и осадков, 20+ параметров
            атмосферы и точный прогноз на 16 суток для любой точки планеты.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.9 }}
            className="mt-9 flex flex-col items-center gap-3.5 sm:flex-row sm:justify-center lg:justify-start"
          >
            <Link
              to="/register"
              className="group relative flex items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-8 py-4 text-base font-bold text-ink-950 shadow-glow transition hover:scale-[1.04] active:scale-95"
            >
              Открыть кабинет
              <ArrowRight size={19} className="transition-transform group-hover:translate-x-1.5" />
            </Link>
            <Link
              to="/login"
              className="glass flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold transition hover:border-aqua-400/40"
            >
              <Zap size={17} className="text-amber-400" />
              Демо-доступ
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 1 }}
            className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4"
          >
            <Stat value="16" suffix=" сут" label="глубина прогноза" />
            <Stat value="20" suffix="+" label="параметров" />
            <Stat value="1.5" suffix=" км" label="сетка модели" />
            <Stat value="100" suffix="%" label="открытые данные" />
          </motion.div>
        </motion.div>

        {/*
          3D-глобус намеренно живёт вне скролл-трансформаций.
          R3F измеряет свой контейнер через getBoundingClientRect, а тот
          возвращает размер уже с учётом transform предка. Любой scale на
          обёртке замыкал петлю «измерил → увеличил буфер → измерил больше»:
          canvas раздувался с 581 px до 50 000 px и обратно не возвращался.
        */}
        <div className="relative z-10 -mx-6 h-[340px] sm:h-[440px] lg:mx-0 lg:h-[620px]">
          <div
            className="pointer-events-none absolute inset-0 -z-10 rounded-full opacity-70 blur-3xl"
            style={{ background: 'radial-gradient(circle at 50% 45%, rgba(53,220,244,.22), transparent 62%)' }}
          />
          <Suspense
            fallback={
              <div className="grid h-full place-items-center">
                <Spinner size={34} className="text-aqua-400" />
              </div>
            }
          >
            <Globe3D
              markers={markers}
              className="h-full w-full"
              enableZoom={zoomable}
              onDragChange={(d) => { if (d) setZoomable(true); }}
              onCitySelect={(c: WorldCity) =>
                onCity({ name: c.name, country: c.country, lat: c.lat, lon: c.lon })}
              onSelect={(m) => onCity({ name: m.label, lat: m.lat, lon: m.lon })}
            />
          </Suspense>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-b from-transparent to-ink-950" />

      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-[var(--text-dim)]"
      >
        <div className="flex h-10 w-6 justify-center rounded-full border border-white/20 pt-2">
          <div className="h-2 w-1 rounded-full bg-aqua-400" />
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function LiveTicker({ cities, loading }: {
  cities: { name: string; temp: number; code: number; wind: number; isDay: number }[];
  loading: boolean;
}) {
  const items = loading ? Array.from({ length: 8 }, (_, i) => null) : [...cities, ...cities];

  return (
    <section className="relative z-20 -mt-8 overflow-hidden border-y border-white/8 bg-ink-900/60 py-5 backdrop-blur-xl">
      <div className="flex gap-3 whitespace-nowrap" style={{ animation: 'drift 30s linear infinite alternate' }}>
        {items.map((c, i) =>
          c ? (
            <div key={i} className="glass flex items-center gap-3 rounded-full px-5 py-2.5">
              <span className="text-lg">{codeEmoji(c.code, !!c.isDay)}</span>
              <span className="text-sm font-semibold">{c.name}</span>
              <span className="font-mono text-sm font-bold" style={{ color: tempColor(c.temp) }}>
                {c.temp > 0 ? '+' : ''}{c.temp}°
              </span>
              <span className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                <Wind size={12} />{c.wind}
              </span>
            </div>
          ) : (
            <div key={i} className="skeleton h-10 w-44 shrink-0 rounded-full" />
          )
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-7xl px-6 py-28 sm:py-36">
      <SectionTitle
        center
        eyebrow="возможности"
        title={<>Всё, что происходит <span className="text-gradient">в атмосфере</span></>}
        subtitle="Шесть инструментов, которые превращают сырые метеоданные в понятную картину — без единой таблицы цифр."
      />

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <GlassCard key={f.title} delay={i * 0.07} className="group relative overflow-hidden p-7">
            <div
              className="absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
              style={{ background: f.color }}
            />
            <div
              className="relative grid h-13 w-13 place-items-center rounded-2xl p-3.5"
              style={{ background: `${f.color}1a`, border: `1px solid ${f.color}33` }}
            >
              <f.icon size={22} style={{ color: f.color }} />
            </div>
            <h3 className="relative mt-5 text-xl font-bold">{f.title}</h3>
            <p className="relative mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">{f.text}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ParameterCloud() {
  const params = [
    ['Температура', Thermometer, '#f97316'], ['Ветер', Wind, '#7df2ff'],
    ['Осадки', Droplets, '#38bdf8'], ['Давление', Gauge, '#a78bfa'],
    ['UV-индекс', Sun, '#fbbf24'], ['Снег', Snowflake, '#e0f2fe'],
    ['Облачность', Layers, '#94a3c4'], ['Влажность', Droplets, '#4ade80'],
    ['Точка росы', Thermometer, '#22d3ee'], ['Порывы', Wind, '#f472b6'],
    ['Видимость', Globe2, '#c084fc'], ['CAPE', Zap, '#facc15'],
  ] as const;

  return (
    <section id="data" className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionTitle
            eyebrow="данные"
            title={<>Открытые источники, <span className="text-gradient">без компромиссов</span></>}
            subtitle="Мы агрегируем свободные метеоданные мирового уровня: глобальные модели ICON, GFS и ECMWF через Open-Meteo, радар RainViewer и индекс качества воздуха CAMS."
          />
          <div className="mt-9 space-y-3">
            {[
              ['Open-Meteo Forecast API', 'ICON / GFS / ECMWF, сетка до 1.5 км'],
              ['Open-Meteo Air Quality', 'CAMS: PM2.5, PM10, NO₂, SO₂, O₃, пыль'],
              ['RainViewer Radar', 'радарная мозаика, кадры каждые 10 минут'],
              ['Open-Meteo Geocoding', 'поиск по 200 000+ населённых пунктов'],
            ].map(([name, desc], i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -22 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.6 }}
                className="glass flex items-center gap-4 rounded-2xl p-4"
              >
                <ShieldCheck size={18} className="shrink-0 text-lime-400" />
                <div>
                  <div className="text-sm font-bold">{name}</div>
                  <div className="text-xs text-[var(--text-dim)]">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative flex flex-wrap justify-center gap-3">
          {params.map(([label, Icon, color], i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              // Раньше каждая плашка бесконечно плыла по CSS-анимации float:
              // блок жил своей жизнью без единого действия пользователя.
              // Движение осталось только как отклик на наведение.
              whileHover={{ scale: 1.08, y: -4 }}
              transition={{ delay: i * 0.045, type: 'spring', stiffness: 220, damping: 18 }}
              className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3"
            >
              <Icon size={16} style={{ color }} />
              <span className="text-sm font-semibold">{label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="how" className="relative mx-auto max-w-7xl px-6 py-28">
      <SectionTitle
        center
        eyebrow="как это работает"
        title={<>Три шага до <span className="text-gradient">полной картины</span></>}
      />
      <div className="relative mt-16 grid gap-8 md:grid-cols-3">
        <div className="absolute left-0 right-0 top-14 hidden h-px bg-gradient-to-r from-transparent via-aqua-400/30 to-transparent md:block" />
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.13, duration: 0.7 }}
            className="relative text-center"
          >
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-aqua-400/30 bg-ink-900 font-mono text-lg font-bold text-aqua-300">
              {s.n}
              <span className="absolute inset-0 rounded-2xl border border-aqua-400/40 animate-pulse-ring" />
            </div>
            <h3 className="mt-6 text-xl font-bold">{s.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">{s.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CTA() {
  return (
    <section className="relative mx-auto max-w-5xl px-6 pb-32">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong relative overflow-hidden rounded-[2.2rem] px-8 py-16 text-center sm:px-16"
      >
        <div className="aurora-blob" style={{ width: 460, height: 460, left: '-10%', top: '-40%', background: 'radial-gradient(circle, rgba(53,220,244,.5), transparent 70%)' }} />
        <div className="aurora-blob" style={{ width: 400, height: 400, right: '-8%', bottom: '-45%', background: 'radial-gradient(circle, rgba(139,92,246,.5), transparent 70%)', animationDelay: '-9s' }} />

        <Sparkles className="relative mx-auto text-aqua-300" size={30} />
        <h2 className="relative mt-6 text-balance text-3xl font-extrabold leading-tight sm:text-5xl">
          Атмосфера ждёт вас
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-[var(--text-dim)]">
          Бесплатно, без карты и лимитов. Загляните в демо-кабинет — он уже наполнен городами.
        </p>
        <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/register"
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-9 py-4 font-bold text-ink-950 shadow-glow transition hover:scale-[1.04] active:scale-95"
          >
            Создать аккаунт
            <ArrowRight size={19} className="transition-transform group-hover:translate-x-1.5" />
          </Link>
          <Link to="/login" className="glass rounded-full px-9 py-4 font-semibold transition hover:border-aqua-400/40">
            Войти в демо
          </Link>
        </div>
        <p className="relative mt-6 font-mono text-xs text-[var(--text-dim)]">
          demo@aeris.app · demo1234
        </p>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-white/8 px-6 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-aqua-400 to-violet-500">
            <Sun className="text-ink-950" size={17} strokeWidth={2.6} />
          </div>
          <div>
            <div className="font-bold">Aeris</div>
            <div className="text-xs text-[var(--text-dim)]">© 2026 · Weather Intelligence Platform</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-[var(--text-dim)]">
          <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="transition hover:text-aqua-300">Open-Meteo</a>
          <a href="https://rainviewer.com" target="_blank" rel="noreferrer" className="transition hover:text-aqua-300">RainViewer</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="transition hover:text-aqua-300">OpenStreetMap</a>
          <Github size={17} />
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  const { data, loading } = useLiveCities();
  const [city, setCity] = useState<ModalCity | null>(null);

  const markers: GlobeMarker[] = useMemo(
    () =>
      data.map((c) => ({
        lat: c.lat, lon: c.lon, label: c.name,
        value: `${c.temp > 0 ? '+' : ''}${c.temp}°`,
        color: tempColor(c.temp),
      })),
    [data]
  );

  return (
    <div className="relative">
      <Aurora intensity={0.85} />
      <div className="noise-overlay" />
      <Nav />
      <main className="relative z-10">
        <Hero markers={markers} loading={loading} onCity={setCity} />
        <LiveTicker cities={data} loading={loading} />
        <Features />
        <ParameterCloud />
        <HowItWorks />
        <CTA />
      </main>
      <Footer />

      <AnimatePresence>
        {city && <CityWeatherModal city={city} onClose={() => setCity(null)} />}
      </AnimatePresence>
    </div>
  );
}
