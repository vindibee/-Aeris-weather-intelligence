import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts';
import { Thermometer, CloudRain, Wind, Droplets, Gauge, Sun } from 'lucide-react';
import type { DayPoint, HourPoint } from '../../hooks/useWeather';
import { codeShortKey, codeEmoji, codeInfo, tempColor, windDir } from '../../lib/weather';

type Metric = 'temp' | 'precip' | 'wind' | 'humidity' | 'pressure' | 'uv';

/* labelKey, а не готовая подпись: константа живёт вне React и вызвать t() здесь нельзя */
const METRICS: { key: Metric; labelKey: string; icon: typeof Wind; color: string; unit: string }[] = [
  { key: 'temp', labelKey: 'weather.temperature', icon: Thermometer, color: '#fb923c', unit: '°' },
  { key: 'precip', labelKey: 'weather.precip', icon: CloudRain, color: '#38bdf8', unit: '%' },
  { key: 'wind', labelKey: 'weather.wind', icon: Wind, color: '#7df2ff', unit: '' },
  { key: 'humidity', labelKey: 'weather.humidity', icon: Droplets, color: '#4ade80', unit: '%' },
  { key: 'pressure', labelKey: 'weather.pressure', icon: Gauge, color: '#a78bfa', unit: '' },
  { key: 'uv', labelKey: 'weather.uvIndex', icon: Sun, color: '#fbbf24', unit: '' },
];

function ChartTooltip({ active, payload, label, metric }: any) {
  const { t } = useTranslation();
  if (!active || !payload?.length) return null;
  const p: HourPoint = payload[0].payload;
  const m = METRICS.find((x) => x.key === metric)!;
  return (
    <div className="glass-strong rounded-2xl px-4 py-3 text-sm shadow-card">
      <div className="flex items-center gap-2 font-semibold">
        <span>{codeEmoji(p.code, !!p.isDay)}</span>
        <span>{label}</span>
        <span className="text-xs text-[var(--text-dim)]">{t(codeShortKey(codeInfo(p.code)))}</span>
      </div>
      <div className="mt-2 space-y-1 font-mono text-xs">
        <div style={{ color: m.color }}>
          {t(m.labelKey)}: <b>{payload[0].value}{m.unit}</b>
        </div>
        {metric === 'temp' && p.feels != null && (
          <div className="text-[var(--text-dim)]">ощущается: {Math.round(p.feels)}°</div>
        )}
        {metric === 'wind' && (
          <div className="text-[var(--text-dim)]">
            порывы: {Math.round(p.gusts ?? 0)} · {windDir(p.dir)}
          </div>
        )}
        {metric === 'precip' && (
          <div className="text-[var(--text-dim)]">объём: {(p.precip ?? 0).toFixed(1)} мм</div>
        )}
      </div>
    </div>
  );
}

export function HourlyChart({ hours }: { hours: HourPoint[] }) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<Metric>('temp');
  const [range, setRange] = useState<24 | 48 | 72>(24);
  const m = METRICS.find((x) => x.key === metric)!;
  const data = hours.slice(0, range);

  const valueOf = (h: HourPoint) => {
    switch (metric) {
      case 'temp': return h.temp == null ? null : Math.round(h.temp);
      case 'precip': return h.precipProb ?? 0;
      case 'wind': return h.wind == null ? null : Math.round(h.wind);
      case 'humidity': return h.humidity ?? 0;
      case 'pressure': return h.pressure == null ? null : Math.round(h.pressure);
      case 'uv': return h.uv == null ? null : +h.uv.toFixed(1);
    }
  };

  const chartData = data.map((h) => ({ ...h, value: valueOf(h) }));

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">Почасовой прогноз</h3>
          <p className="text-xs text-[var(--text-dim)]">Следующие {range} часа · шаг 1 час</p>
        </div>
        <div className="glass flex gap-1 rounded-full p-1">
          {([24, 48, 72] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`relative rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                range === r ? 'text-ink-950' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              {range === r && (
                <motion.span layoutId="range-pill"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-aqua-400 to-violet-400" />
              )}
              <span className="relative">{r}ч</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {METRICS.map((x) => (
          <button
            key={x.key}
            onClick={() => setMetric(x.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              metric === x.key
                ? 'border-transparent text-ink-950'
                : 'border-white/10 text-[var(--text-dim)] hover:border-white/25 hover:text-[var(--text)]'
            }`}
            style={metric === x.key ? { background: x.color } : undefined}
          >
            <x.icon size={13} />
            {t(x.labelKey)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={metric + range}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28 }}
          className="mt-5 h-[280px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'precip' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="precipBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
                       interval={range === 24 ? 2 : range === 48 ? 5 : 7} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                <Bar dataKey="value" fill="url(#precipBar)" radius={[6, 6, 0, 0]} animationDuration={700} />
              </BarChart>
            ) : metric === 'wind' ? (
              <ComposedChart data={chartData} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="windArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7df2ff" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#7df2ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
                       interval={range === 24 ? 2 : range === 48 ? 5 : 7} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ stroke: 'rgba(125,242,255,.3)' }} />
                <Area type="monotone" dataKey="value" stroke="#7df2ff" strokeWidth={2.4}
                      fill="url(#windArea)" animationDuration={800} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="gusts" stroke="#f472b6" strokeWidth={1.6}
                      strokeDasharray="4 4" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} animationDuration={900} />
              </ComposedChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={m.color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={m.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-dim)' }}
                       interval={range === 24 ? 2 : range === 48 ? 5 : 7} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} axisLine={false} tickLine={false}
                       domain={metric === 'pressure' ? ['dataMin - 3', 'dataMax + 3'] : ['auto', 'auto']} />
                <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ stroke: `${m.color}55` }} />
                <Area type="monotone" dataKey="value" stroke={m.color} strokeWidth={2.6}
                      fill={`url(#grad-${metric})`} animationDuration={800} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                {metric === 'temp' && (
                  <Line type="monotone" dataKey="feels" stroke="#f472b6" strokeWidth={1.5}
                        strokeDasharray="5 4" dot={false} activeDot={{ r: 3, strokeWidth: 0 }} animationDuration={900} />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </motion.div>
      </AnimatePresence>

      {metric === 'temp' && (
        <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-orange-400" />фактическая</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-magenta-400" />ощущается</span>
        </div>
      )}
      {metric === 'wind' && (
        <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--text-dim)]">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-aqua-300" />скорость</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t border-dashed border-magenta-400" />порывы</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function DailyForecast({ days, units }: { days: DayPoint[]; units: 'metric' | 'imperial' }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);
  const maxes = days.map((d) => d.max ?? 0);
  const mins = days.map((d) => d.min ?? 0);
  const hi = Math.max(...maxes, 1);
  const lo = Math.min(...mins, 0);
  const span = Math.max(1, hi - lo);

  const day = days[selected];

  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold">Прогноз на {days.length} дней</h3>
        <span className="text-xs text-[var(--text-dim)]">нажмите на день</span>
      </div>

      <div className="mt-5 space-y-1">
        {days.map((d, i) => {
          const leftPct = (((d.min ?? 0) - lo) / span) * 100;
          const widthPct = (((d.max ?? 0) - (d.min ?? 0)) / span) * 100;
          const active = i === selected;
          return (
            <button
              key={d.iso}
              onClick={() => setSelected(i)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                active ? 'bg-white/8' : 'hover:bg-white/5'
              }`}
            >
              <div className="w-14 shrink-0">
                <div className={`text-sm font-bold ${d.isToday ? 'text-aqua-300' : ''}`}>
                  {d.isToday ? t('weather.today') : d.weekday}
                </div>
                <div className="text-[10px] text-[var(--text-dim)]">{d.label}</div>
              </div>

              <span className="w-7 shrink-0 text-center text-lg">{codeEmoji(d.code, true)}</span>

              <span className="hidden w-12 shrink-0 items-center gap-1 text-[11px] text-sky-300 sm:flex">
                {(d.precipProb ?? 0) > 5 ? `${d.precipProb}%` : ''}
              </span>

              <span className="w-9 shrink-0 text-right font-mono text-sm text-[var(--text-dim)]">
                {Math.round(d.min ?? 0)}°
              </span>

              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: `${Math.max(4, widthPct)}%`, opacity: 1, left: `${leftPct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-0 h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${tempColor(d.min, units)}, ${tempColor(d.max, units)})`,
                  }}
                />
              </div>

              <span className="w-9 shrink-0 font-mono text-sm font-bold">{Math.round(d.max ?? 0)}°</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {day && (
          <motion.div
            key={day.iso}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/8 pt-5 sm:grid-cols-4">
              {[
                [t('weather.conditions'), t(codeShortKey(codeInfo(day.code)))],
                [t('weather.precip'), `${(day.precipSum ?? 0).toFixed(1)} ${t('units.mm')} · ${day.precipProb ?? 0}%`],
                [t('weather.wind'), `${Math.round(day.windMax ?? 0)} · ${t('weather.gusts')} ${Math.round(day.gustMax ?? 0)}`],
                [t('weather.uvMax'), `${(day.uvMax ?? 0).toFixed(1)}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/4 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{k}</div>
                  <div className="mt-1 text-sm font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Compact 24-hour temperature strip used at the top of the overview. */
export function HourStrip({ hours, units }: { hours: HourPoint[]; units: 'metric' | 'imperial' }) {
  const { t } = useTranslation();
  return (
    <div className="glass overflow-x-auto rounded-3xl p-4">
      <div className="flex gap-2">
        {hours.slice(0, 24).map((h, i) => (
          <motion.div
            key={h.iso}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02, duration: 0.4 }}
            className={`flex min-w-[68px] flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition ${
              h.isNow ? 'bg-aqua-400/12 ring-1 ring-aqua-400/35' : 'hover:bg-white/5'
            }`}
          >
            <span className={`text-[11px] font-semibold ${h.isNow ? 'text-aqua-300' : 'text-[var(--text-dim)]'}`}>
              {h.isNow ? t('weather.now') : h.time}
            </span>
            <span className="text-xl">{codeEmoji(h.code, !!h.isDay)}</span>
            <span className="font-mono text-sm font-bold" style={{ color: tempColor(h.temp, units) }}>
              {Math.round(h.temp ?? 0)}°
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-sky-300">
              {(h.precipProb ?? 0) > 5 ? `${h.precipProb}%` : ' '}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
