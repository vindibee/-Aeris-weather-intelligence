import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Thermometer, Cloud, CloudRain, Droplets, Wind, Layers, Play, Pause,
  Radar, X, Crosshair, Star, EyeOff, Loader2,
} from 'lucide-react';
import { useApp } from '../../lib/store';
import { useLocationMutations, useRadar } from '../../hooks/useWeather';
import { api, type GeoFallback, type GridResponse } from '../../lib/api';
import { codeEmoji, codeInfo, tempColor, windDir, windLabel } from '../../lib/weather';
import { LoadingPanel, Spinner } from '../../components/ui';
import type { OverlayKind } from '../../components/weather/WeatherMap';

const WeatherMap = lazy(() => import('../../components/weather/WeatherMap'));

const OVERLAYS: { key: OverlayKind; label: string; icon: typeof Wind; color: string }[] = [
  { key: 'temp', label: 'Температура', icon: Thermometer, color: '#fb923c' },
  { key: 'precip', label: 'Осадки', icon: CloudRain, color: '#38bdf8' },
  { key: 'clouds', label: 'Облачность', icon: Cloud, color: '#cbd5e1' },
  { key: 'humidity', label: 'Влажность', icon: Droplets, color: '#4ade80' },
  { key: 'none', label: 'Без слоя', icon: EyeOff, color: '#94a3c4' },
];

const TEMP_LEGEND = [-30, -20, -10, 0, 10, 20, 30, 40];
const WIND_LEGEND: [number, string][] = [
  [5, 'штиль'], [15, 'слабый'], [25, 'умеренный'], [40, 'сильный'], [60, 'шторм'], [80, 'ураган'],
];

function PointCard({
  point, onClose,
}: { point: { lat: number; lon: number }; onClose: () => void }) {
  const units = useApp((s) => s.units);
  const setPlace = useApp((s) => s.setPlace);
  const { add } = useLocationMutations();
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  // сервер мог отойти от запрошенной точки к ближайшей с наблюдениями —
  // об этом надо сказать, а не выдавать чужие данные за данные этой точки
  const [fallback, setFallback] = useState<GeoFallback | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    Promise.all([
      api.bulk([{ lat: point.lat, lon: point.lon }], units),
      api.reverse(point.lat, point.lon).catch(() => null),
    ])
      .then(([bulk, rev]) => {
        if (!alive) return;
        const p = bulk.points[0] ?? null;
        setData(p);
        setName(rev?.name ?? `${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}`);
        setFallback(p?.fallback ?? rev?.fallback ?? null);
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [point.lat, point.lon, units]);

  const cur = data?.current;
  const daily = data?.daily;
  const info = codeInfo(cur?.weather_code);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="absolute bottom-4 left-4 z-20 w-[300px] rounded-3xl border border-white/12 p-5 shadow-card backdrop-blur-2xl"
      style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
    >
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--text-dim)] transition hover:bg-white/10 hover:text-[var(--text)]"
      >
        <X size={15} />
      </button>

      <div className="flex items-center gap-2 text-xs text-aqua-300">
        <Crosshair size={13} />
        <span className="font-mono">{point.lat.toFixed(3)}, {point.lon.toFixed(3)}</span>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          <div className="skeleton h-6 w-2/3" />
          <div className="skeleton h-12 w-1/2" />
          <div className="skeleton h-4 w-full" />
        </div>
      ) : cur ? (
        <>
          <h3 className="mt-1.5 truncate text-lg font-bold">{name}</h3>

          {fallback && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-snug text-amber-200">
              <Crosshair size={12} className="mt-0.5 shrink-0" />
              <span>
                В этой точке наблюдений нет — показана ближайшая, в {fallback.distanceKm} км отсюда.
              </span>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-4xl">{codeEmoji(cur.weather_code, cur.is_day)}</span>
            <div>
              <div className="font-mono text-3xl font-bold" style={{ color: tempColor(cur.temperature_2m, units) }}>
                {Math.round(cur.temperature_2m)}°
              </div>
              <div className="text-xs text-[var(--text-dim)]">{info.label}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 p-2.5">
              <div className="text-[var(--text-dim)]">Ощущается</div>
              <div className="mt-0.5 font-mono font-bold">{Math.round(cur.apparent_temperature)}°</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2.5">
              <div className="text-[var(--text-dim)]">Ветер</div>
              <div className="mt-0.5 font-mono font-bold">{Math.round(cur.wind_speed_10m)}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2.5">
              <div className="text-[var(--text-dim)]">Влажность</div>
              <div className="mt-0.5 font-mono font-bold">{cur.relative_humidity_2m}%</div>
            </div>
            <div className="rounded-xl bg-white/5 p-2.5">
              <div className="text-[var(--text-dim)]">Завтра</div>
              <div className="mt-0.5 font-mono font-bold">
                {Math.round(daily?.temperature_2m_min?.[1] ?? 0)}° / {Math.round(daily?.temperature_2m_max?.[1] ?? 0)}°
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setPlace({ name, lat: point.lat, lon: point.lon })}
              className="flex-1 rounded-xl bg-gradient-to-r from-aqua-400 to-violet-500 py-2.5 text-xs font-bold text-ink-950 transition hover:scale-[1.02]"
            >
              Сделать основной
            </button>
            <button
              onClick={() => add.mutate({ name, lat: point.lat, lon: point.lon, country: null, admin1: null } as any)}
              disabled={add.isPending}
              className="glass rounded-xl px-3 py-2.5 text-amber-300 transition hover:border-amber-400/40"
              title="В избранное"
            >
              {add.isPending ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} />}
            </button>
          </div>
        </>
      ) : (
        <div className="py-6 text-center text-sm text-[var(--text-dim)]">
          Данных нет ни в этой точке, ни в радиусе 800 км
        </div>
      )}
    </motion.div>
  );
}

export default function MapPage() {
  const place = useApp((s) => s.place);
  const theme = useApp((s) => s.theme);
  const [overlay, setOverlay] = useState<OverlayKind>('temp');
  const [showWind, setShowWind] = useState(true);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [grid, setGrid] = useState<GridResponse | null>(null);

  const { data: radar } = useRadar();
  const frames = useMemo(
    () => [...(radar?.radar.past ?? []), ...(radar?.radar.nowcast ?? [])],
    [radar]
  );
  const [radarOn, setRadarOn] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (frames.length) setFrameIdx(Math.max(0, (radar?.radar.past.length ?? 1) - 1));
  }, [frames.length, radar]);

  useEffect(() => {
    if (!radarOn || !playing || frames.length < 2) return;
    const t = setInterval(() => setFrameIdx((i) => (i + 1) % frames.length), 620);
    return () => clearInterval(t);
  }, [radarOn, playing, frames.length]);

  const frame = radarOn && frames.length ? frames[Math.min(frameIdx, frames.length - 1)] : null;
  const frameTime = frame ? new Date(frame.time * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

  const stats = useMemo(() => {
    if (!grid?.cells.length) return null;
    const temps = grid.cells.map((c) => c.temp).filter((v): v is number => v != null);
    const winds = grid.cells.map((c) => c.wind).filter((v): v is number => v != null);
    if (!temps.length) return null;
    return {
      min: Math.min(...temps), max: Math.max(...temps),
      avg: temps.reduce((a, b) => a + b, 0) / temps.length,
      windMax: winds.length ? Math.max(...winds) : 0,
      cells: grid.cells.length,
    };
  }, [grid]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Метео-карта</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Кликните по любой точке, чтобы увидеть прогноз · слои обновляются при перемещении
          </p>
        </div>
        {stats && (
          <div className="glass flex gap-4 rounded-2xl px-4 py-2.5 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">В кадре</div>
              <div className="font-mono font-bold">{stats.cells} точек</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Температура</div>
              <div className="font-mono font-bold">
                <span style={{ color: tempColor(stats.min) }}>{Math.round(stats.min)}°</span>
                {' … '}
                <span style={{ color: tempColor(stats.max) }}>{Math.round(stats.max)}°</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Макс. ветер</div>
              <div className="font-mono font-bold">{Math.round(stats.windMax)}</div>
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
          {OVERLAYS.map((o) => (
            <button
              key={o.key}
              onClick={() => setOverlay(o.key)}
              className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                overlay === o.key ? 'text-ink-950' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {overlay === o.key && (
                <motion.span layoutId="overlay-pill" className="absolute inset-0 rounded-xl"
                             style={{ background: o.color }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
              )}
              <o.icon size={14} className="relative" />
              <span className="relative hidden sm:inline">{o.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowWind((v) => !v)}
          className={`glass flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
            showWind ? 'border-aqua-400/50 text-aqua-300' : 'text-[var(--text-dim)]'
          }`}
        >
          <Wind size={14} />
          Потоки ветра
          <span className={`h-1.5 w-1.5 rounded-full ${showWind ? 'bg-aqua-400' : 'bg-white/25'}`} />
        </button>

        <button
          onClick={() => setRadarOn((v) => !v)}
          className={`glass flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold transition ${
            radarOn ? 'border-magenta-400/50 text-magenta-400' : 'text-[var(--text-dim)]'
          }`}
        >
          <Radar size={14} />
          Радар осадков
          <span className={`h-1.5 w-1.5 rounded-full ${radarOn ? 'bg-magenta-400' : 'bg-white/25'}`} />
        </button>
      </div>

      {/* radar timeline */}
      <AnimatePresence>
        {radarOn && frames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass flex items-center gap-4 rounded-2xl px-4 py-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-aqua-400 to-violet-500 text-ink-950"
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={Math.min(frameIdx, frames.length - 1)}
                onChange={(e) => { setPlaying(false); setFrameIdx(Number(e.target.value)); }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/12 accent-aqua-400"
              />
              <div className="w-32 shrink-0 text-right">
                <div className="font-mono text-sm font-bold text-magenta-400">{frameTime}</div>
                <div className="text-[10px] text-[var(--text-dim)]">
                  кадр {frameIdx + 1} / {frames.length}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* map */}
      <div className="relative h-[calc(100svh-19rem)] min-h-[460px] w-full">
        <Suspense fallback={<div className="glass grid h-full place-items-center rounded-3xl"><LoadingPanel label="Инициализируем карту" /></div>}>
          <WeatherMap
            center={{ lat: place.lat, lon: place.lon }}
            overlay={overlay}
            showWind={showWind}
            radarFrame={frame}
            radarOpacity={0.72}
            theme={theme}
            onPointPick={setPoint}
            onGridChange={(g) => setGrid(g)}
          />
        </Suspense>

        <AnimatePresence>
          {point && <PointCard point={point} onClose={() => setPoint(null)} />}
        </AnimatePresence>

        {/* legend */}
        <div className="absolute right-4 top-4 z-10 hidden rounded-2xl border border-white/12 p-3.5 backdrop-blur-2xl sm:block"
             style={{ background: 'color-mix(in srgb, var(--bg) 86%, transparent)' }}>
          {overlay === 'temp' && (
            <>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                Температура, °C
              </div>
              <div className="flex h-3 w-44 overflow-hidden rounded-full">
                {TEMP_LEGEND.map((t) => (
                  <div key={t} className="flex-1" style={{ background: tempColor(t) }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-[var(--text-dim)]">
                {TEMP_LEGEND.filter((_, i) => i % 2 === 0).map((t) => <span key={t}>{t}</span>)}
              </div>
            </>
          )}
          {showWind && (
            <div className={overlay === 'temp' ? 'mt-3.5 border-t border-white/8 pt-3' : ''}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                Ветер, км/ч
              </div>
              <div className="space-y-1">
                {WIND_LEGEND.map(([v, label]) => (
                  <div key={v} className="flex items-center gap-2 text-[10px]">
                    <span className="h-0.5 w-6 rounded-full" style={{ background: windColorOf(v) }} />
                    <span className="text-[var(--text-dim)]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function windColorOf(v: number) {
  if (v < 8) return '#7df2ff';
  if (v < 18) return '#4ade80';
  if (v < 30) return '#fbbf24';
  if (v < 50) return '#fb923c';
  if (v < 75) return '#f43f5e';
  return '#e879f9';
}
