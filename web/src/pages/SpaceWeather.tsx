import { useEffect, useMemo, useState } from 'react';
import { localeTag } from '../i18n';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Globe2, Thermometer, Gauge, Wind, FlaskConical,
  Sun, Zap, Satellite, X, Radio, CircleDot, Clock, Orbit, Moon, AlertTriangle,
  RotateCw, Maximize2, Minimize2,
} from 'lucide-react';
import { api, type Planet, type SpaceWeather as SpaceWeatherData } from '../lib/api';
import { Aurora } from '../components/Atmosphere';
import { LoadingPanel, ErrorPanel } from '../components/ui';
import PlanetGlobe from '../components/space/PlanetScene';

/* ------------------------------------------------------------------ */
/*  Форматирование метрик                                              */
/* ------------------------------------------------------------------ */

const temp = (v: number) => `${v > 0 ? '+' : ''}${v} °C`;

/** Диапазон давления охватывает 16 порядков — от экзосферы Меркурия до Венеры. */
function pressure(bar: number) {
  if (bar >= 0.01) return `${bar.toLocaleString(localeTag(), { maximumFractionDigits: 3 })} бар`;
  if (bar >= 0.0001) return `${(bar * 1000).toFixed(2)} мбар`;
  if (bar === 0) return 'нет';
  const exp = Math.floor(Math.log10(bar));
  const mant = (bar / 10 ** exp).toFixed(1);
  return `${mant}·10${superscript(exp)} бар`;
}

const SUPERS: Record<string, string> = {
  '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
  5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
};
const superscript = (n: number) => String(n).split('').map((c) => SUPERS[c] ?? c).join('');

const wind = (v: number | null) =>
  v == null ? 'нет данных' : `${v} м/с · ${Math.round(v * 3.6)} км/ч`;

const sourceStyle = (source: Planet['source']) =>
  source === 'live'
    ? { color: '#4ade80', bg: 'rgba(74,222,128,.12)', border: 'rgba(74,222,128,.35)', label: 'live' }
    : { color: '#fbbf24', bg: 'rgba(251,191,36,.12)', border: 'rgba(251,191,36,.32)', label: 'резерв' };

/* ------------------------------------------------------------------ */
/*  Солнечная активность                                               */
/* ------------------------------------------------------------------ */

function kpTone(kp: number | null) {
  if (kp == null) return { label: 'нет данных', color: '#94a3c4' };
  if (kp < 4) return { label: 'спокойно', color: '#4ade80' };
  if (kp < 5) return { label: 'неустойчиво', color: '#fbbf24' };
  if (kp < 7) return { label: 'буря G1–G2', color: '#fb923c' };
  return { label: 'сильная буря', color: '#f43f5e' };
}

function SolarPanel({ data }: { data: SpaceWeatherData }) {
  const { solar } = data;
  const tone = kpTone(solar.kpIndex);
  const live = solar.source === 'live';

  return (
    <div className="glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-7">
      <div className="aurora-blob" style={{ width: 320, height: 320, right: '-14%', top: '-60%', background: 'radial-gradient(circle, rgba(251,191,36,.35), transparent 70%)' }} />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400/15 text-amber-300">
            <Sun size={21} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Солнечная активность</h2>
            <p className="text-xs text-[var(--text-dim)]">
              {live ? 'NASA DONKI · последние 30 суток' : 'Живой канал недоступен — сводка из резерва'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full px-3.5 py-2"
             style={{ background: `${tone.color}1a`, border: `1px solid ${tone.color}44` }}>
          <Radio size={14} style={{ color: tone.color }} />
          <span className="font-mono text-sm font-bold" style={{ color: tone.color }}>
            Kp {solar.kpIndex ?? '—'}
          </span>
          <span className="text-xs text-[var(--text-dim)]">{tone.label}</span>
        </div>
      </div>

      <div className="relative mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
            <Zap size={13} className="text-amber-300" />
            Вспышки
            <span className="ml-auto font-mono">{solar.flares.length}</span>
          </div>
          {solar.flares.length ? (
            <ul className="mt-3 space-y-1.5">
              {solar.flares.slice(0, 4).map((f, i) => (
                <li key={f.id ?? i} className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 font-mono font-bold text-amber-300">
                    {f.classType ?? '—'}
                  </span>
                  <span className="truncate text-[var(--text-dim)]">
                    {f.peakTime ? new Date(f.peakTime).toLocaleString(localeTag(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  {f.sourceLocation && (
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--text-dim)]">{f.sourceLocation}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--text-dim)]">За период вспышек не зарегистрировано.</p>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
            <Satellite size={13} className="text-violet-300" />
            Геомагнитные бури
            <span className="ml-auto font-mono">{solar.storms.length}</span>
          </div>
          {solar.storms.length ? (
            <ul className="mt-3 space-y-1.5">
              {solar.storms.slice(0, 4).map((g, i) => (
                <li key={g.id ?? i} className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-violet-400/15 px-1.5 py-0.5 font-mono font-bold text-violet-300">
                    Kp {g.maxKp ?? '—'}
                  </span>
                  <span className="truncate text-[var(--text-dim)]">
                    {g.startTime ? new Date(g.startTime).toLocaleString(localeTag(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--text-dim)]">Магнитосфера спокойна.</p>
          )}
        </div>
      </div>

      {solar.summary && (
        <p className="relative mt-4 text-sm leading-relaxed text-[var(--text-dim)]">{solar.summary}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Карточка планеты                                                   */
/* ------------------------------------------------------------------ */

function PlanetCard({
  planet, index, onOpen, showGlobe,
}: {
  planet: Planet;
  index: number;
  onOpen: () => void;
  /**
   * Пока открыта модалка, её глобус — девятый WebGL-контекст на странице.
   * Браузеры держат ограниченное их число и вытесняют старые, поэтому на время
   * модалки карточки отдают свои контексты и показывают статичную заглушку.
   */
  showGlobe: boolean;
}) {
  const badge = sourceStyle(planet.source);

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="glass group relative overflow-hidden rounded-3xl p-5"
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-xl font-extrabold">{planet.name}</h3>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-dim)]">{planet.kind} · {planet.au} а.е.</p>
        </div>
        <span className="shrink-0 font-mono text-2xl font-bold text-[var(--text-dim)] opacity-40">
          {String(planet.order).padStart(2, '0')}
        </span>
      </div>

      {/*
        Прозрачное окно, в которое общий Canvas рисует эту планету.
        Один WebGL-контекст на все восемь глобусов вместо восьми отдельных.
      */}
      <div
        className="relative z-10 mx-auto mt-2 h-56 w-full"
        aria-label={`3D-модель планеты ${planet.name}, вращается перетаскиванием`}
      >
        {showGlobe ? (
          <PlanetGlobe
            visual={planet.visual}
            className="h-full w-full"
            distance={4.4}
            enableZoom={false}
            dpr={1.5}
            detail={5}
          />
        ) : (
          <div
            className="mx-auto h-full w-full"
            style={{
              background: `radial-gradient(circle at 42% 38%, ${planet.visual.rim}, ${planet.visual.mid} 42%, ${planet.visual.deep} 72%, transparent 73%)`,
            }}
          />
        )}
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Средняя</div>
          <div className="mt-0.5 font-mono text-sm font-bold">{temp(planet.metrics.tempMean)}</div>
        </div>
        <div className="rounded-xl bg-white/5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Давление</div>
          <div className="mt-0.5 font-mono text-sm font-bold">{pressure(planet.metrics.pressureBar)}</div>
        </div>
        <div className="rounded-xl bg-white/5 py-2">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Ветер</div>
          <div className="mt-0.5 font-mono text-sm font-bold">
            {planet.metrics.windMax == null ? '—' : `${planet.metrics.windMax} м/с`}
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-3 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
        {planet.tagline}
      </p>

      <button
        onClick={onOpen}
        className="relative z-10 mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 py-2.5 text-xs font-bold transition hover:border-aqua-400/50 hover:bg-white/5"
      >
        Все метрики
        <ArrowRight size={14} />
      </button>
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/*  Модальная карточка с метриками                                     */
/* ------------------------------------------------------------------ */

function MetricRow({ icon: Icon, label, value, note, color }: {
  icon: typeof Wind; label: string; value: string; note?: string; color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-3.5">
      <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
           style={{ background: `${color}1a`, border: `1px solid ${color}33` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
        <div className="mt-0.5 font-mono text-base font-bold">{value}</div>
        {note && <div className="mt-1 text-xs leading-snug text-[var(--text-dim)]">{note}</div>}
      </div>
    </div>
  );
}

function PlanetModal({ planet, onClose }: { planet: Planet; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const badge = sourceStyle(planet.source);
  const isEarth = planet.id === 'earth';
  const [climate, setClimate] = useState(false);
  const [spin, setSpin] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 26, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong relative my-auto w-full max-w-4xl overflow-hidden rounded-[1.8rem] p-6 shadow-card sm:p-8"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-xl p-2 text-[var(--text-dim)] transition hover:bg-white/10 hover:text-[var(--text)]"
          aria-label="Закрыть"
        >
          <X size={17} />
        </button>

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_1.25fr]">
          {/* globe */}
          <div>
            {/* кольцевым планетам нужен запас кадра, иначе кольца срезает краем */}
            <PlanetGlobe
              visual={planet.visual}
              className="h-[300px] w-full"
              distance={planet.visual.ring ? 6.4 : 4.4}
              climate={climate}
              autoRotate={spin}
              detail={6}
              dpr={2}
              alwaysRender
            />
            <p className="mt-1 text-center text-[11px] text-[var(--text-dim)]">
              Потяните планету · колесо приближает
            </p>

            {/* режимы просмотра */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={() => setClimate((v) => !v)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${
                  climate ? 'border-amber-400/50 bg-amber-400/10 text-amber-200'
                          : 'border-white/10 text-[var(--text-dim)] hover:border-white/25'
                }`}
              >
                <Thermometer size={14} />
                Климат-пояса
              </button>
              <button
                onClick={() => setSpin((v) => !v)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${
                  spin ? 'border-aqua-400/50 bg-aqua-400/10 text-aqua-200'
                       : 'border-white/10 text-[var(--text-dim)] hover:border-white/25'
                }`}
              >
                <RotateCw size={14} />
                {spin ? 'Остановить' : 'Медленное вращение'}
              </button>
              <button
                onClick={() => setFull(true)}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 px-2 py-2.5 text-[11px] font-semibold text-[var(--text-dim)] transition hover:border-white/25"
              >
                <Maximize2 size={14} />
                Во весь экран
              </button>
            </div>

            {climate && (
              <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-[11px] leading-snug text-amber-200/90">
                Экватор окрашен тёплым, полюса — ледяным; белые линии отмечают
                тропики (23.5°) и полярные круги (66.5°).
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <Clock size={13} className="shrink-0 text-aqua-300" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-[var(--text-dim)]">Сутки</div>
                  <div className="truncate font-semibold">{planet.dayLength}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <Orbit size={13} className="shrink-0 text-violet-300" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-[var(--text-dim)]">Год</div>
                  <div className="truncate font-semibold">{planet.yearLength}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <CircleDot size={13} className="shrink-0 text-amber-300" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-[var(--text-dim)]">Радиус</div>
                  <div className="truncate font-semibold">{planet.radiusKm.toLocaleString(localeTag())} км</div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
                <Moon size={13} className="shrink-0 text-[var(--text-dim)]" />
                <div className="min-w-0">
                  <div className="text-[10px] uppercase text-[var(--text-dim)]">Спутники</div>
                  <div className="truncate font-semibold">{planet.moons}</div>
                </div>
              </div>
            </div>
          </div>

          {/* metrics */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-3xl font-extrabold tracking-tight">{planet.name}</h2>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}
              >
                {badge.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-dim)]">{planet.kind} · {planet.au} а.е. от Солнца · g = {planet.gravity} м/с²</p>
            <p className="mt-3 text-[15px] leading-relaxed">{planet.tagline}</p>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--text-dim)]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: badge.color }} />
              <span>Источник: {planet.sourceNote}</span>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <MetricRow
                icon={Thermometer} color="#fb923c" label="Температура"
                value={temp(planet.metrics.tempMean)}
                note={`от ${temp(planet.metrics.tempMin)} до ${temp(planet.metrics.tempMax)}`}
              />
              <MetricRow
                icon={Gauge} color="#a78bfa" label="Атмосферное давление"
                value={pressure(planet.metrics.pressureBar)}
                note={planet.metrics.pressureNote}
              />
              <MetricRow
                icon={Wind} color="#7df2ff" label="Скорость ветра"
                value={wind(planet.metrics.windMax)}
                note={planet.metrics.windNote}
              />
              <MetricRow
                icon={FlaskConical} color="#4ade80" label="Основной компонент"
                value={`${planet.metrics.composition[0]?.formula ?? '—'} · ${planet.metrics.composition[0]?.share ?? 0}%`}
                note={planet.metrics.composition[0]?.name}
              />
            </div>

            {/* состав атмосферы */}
            <div className="mt-4 rounded-2xl bg-white/5 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                Состав атмосферы
              </div>
              <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/8">
                {planet.metrics.composition.map((c, i) => (
                  <div
                    key={c.formula}
                    style={{
                      width: `${Math.max(1.5, c.share)}%`,
                      background: ['#7df2ff', '#a78bfa', '#4ade80', '#fbbf24', '#f472b6'][i % 5],
                    }}
                    title={`${c.name} ${c.share}%`}
                  />
                ))}
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {planet.metrics.composition.map((c, i) => (
                  <li key={c.formula} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: ['#7df2ff', '#a78bfa', '#4ade80', '#fbbf24', '#f472b6'][i % 5] }} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[var(--text-dim)]">{c.formula} {c.share}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-4 space-y-1.5">
              {planet.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-aqua-400" />
                  {h}
                </li>
              ))}
            </ul>

            {isEarth && (
              <button
                onClick={() => navigate('/#globe')}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-400 to-violet-500 py-3.5 text-sm font-bold text-ink-950 shadow-glow transition hover:scale-[1.02] active:scale-95"
              >
                <Globe2 size={17} />
                Открыть земной глобус с картой городов
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {full && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); setFull(false); }}
            className="fixed inset-0 z-[80] bg-ink-950"
          >
            <PlanetGlobe
              visual={planet.visual}
              className="h-full w-full"
              distance={planet.visual.ring ? 5.6 : 3.9}
              climate={climate}
              autoRotate={spin}
              detail={6}
              dpr={2}
              alwaysRender
            />
            <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 text-center">
              <div className="text-2xl font-extrabold tracking-tight">{planet.name}</div>
              <div className="text-xs text-[var(--text-dim)]">{planet.kind} · {planet.au} а.е.</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFull(false); }}
              className="glass absolute right-6 top-6 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              <Minimize2 size={15} />
              Свернуть
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-xs text-[var(--text-dim)]">
              {t('space.dragZoomHint')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

export default function SpaceWeatherPage() {
  const [open, setOpen] = useState<Planet | null>(null);

  const { data, isLoading, error, refetch } = useQuery<SpaceWeatherData>({
    queryKey: ['space-weather'],
    queryFn: () => api.spaceWeather(),
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const planets = useMemo(
    () => [...(data?.planets ?? [])].sort((a, b) => a.order - b.order),
    [data]
  );

  const liveCount = planets.filter((p) => p.source === 'live').length;

  return (
    <div className="relative min-h-[100svh]">
      <Aurora intensity={0.6} />
      <div className="noise-overlay" />

      {/* шапка */}
      <header className="relative z-30 mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
        <Link
          to="/"
          className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition hover:border-aqua-400/40"
        >
          <ArrowLeft size={16} />
          На главную
        </Link>
        <Link
          to="/app"
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-5 py-2.5 text-sm font-bold text-ink-950 shadow-glow transition hover:scale-[1.03] active:scale-95"
        >
          Земной кабинет
          <ArrowRight size={15} />
        </Link>
      </header>

      <main className="relative z-30 mx-auto max-w-7xl px-6 pb-24">
        <div className="max-w-3xl">
          <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-violet-300">
            <Satellite size={13} />
            NASA Open API · Open-Meteo · локальный резерв
          </div>
          <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Погода в <span className="text-gradient">космосе</span>
          </h1>
          <p className="mt-5 text-pretty text-base leading-relaxed text-[var(--text-dim)] sm:text-lg">
            Восемь планет, у каждой — своя атмосфера, давление и ветры. Там, где есть публичный
            живой источник, тянем его; для остальных показываем выверенные справочные данные.
            Каждый глобус вращается мышью.
          </p>

          {data && (
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="glass rounded-full px-3 py-1.5">
                Живых источников: <b className="text-lime-300">{liveCount}</b> из {planets.length}
              </span>
              <span className="glass rounded-full px-3 py-1.5">
                Марс: <b className={data.sources.mars === 'fallback' ? 'text-amber-300' : 'text-lime-300'}>
                  {data.sources.mars === 'fallback' ? 'резерв' : 'NASA InSight'}
                </b>
              </span>
              <span className="glass rounded-full px-3 py-1.5">
                Солнце: <b className={data.sources.solar === 'fallback' ? 'text-amber-300' : 'text-lime-300'}>
                  {data.sources.solar === 'fallback' ? 'резерв' : 'NASA DONKI'}
                </b>
              </span>
              <span className="glass rounded-full px-3 py-1.5">
                Обновлено {new Date(data.fetchedAt).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-16">
            <LoadingPanel label="Связываемся с межпланетной сетью" />
          </div>
        )}

        {error && (
          <div className="mt-12">
            <ErrorPanel
              message={(error as Error).message ?? 'Не удалось загрузить космическую сводку'}
              onRetry={() => refetch()}
            />
          </div>
        )}

        {data && (
          <>
            <div className="mt-10">
              <SolarPanel data={data} />
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {planets.map((p, i) => (
                <PlanetCard
                  key={p.id}
                  planet={p}
                  index={i}
                  onOpen={() => setOpen(p)}
                  showGlobe={!open}
                />
              ))}
            </div>

            <p className="mt-10 text-center text-xs text-[var(--text-dim)]">
              Справочные значения — NASA Planetary Fact Sheet, ревизия {data.revision}.
              Живые каналы: NASA InSight (Марс), NASA DONKI (Солнце), Open-Meteo (Земля).
            </p>
          </>
        )}
      </main>

      <AnimatePresence>
        {open && <PlanetModal planet={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}
