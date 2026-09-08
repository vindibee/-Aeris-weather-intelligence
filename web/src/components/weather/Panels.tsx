import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Wind, Sun, Droplets, Gauge, Eye, Thermometer, Cloud, Zap, Activity,
  TrendingUp, TrendingDown, Minus, Leaf, Timer,
} from 'lucide-react';
import type { ForecastBundle } from '../../lib/api';
import { Meter } from '../ui';
import {
  aqiInfo, comfortIndex, uvInfo, dirLabel, windLabelKey, pressureTrend,
} from '../../lib/weather';
import type { DayPoint, HourPoint } from '../../hooks/useWeather';

function Panel({ title, icon: Icon, children, className = '', delay = 0 }: {
  title: string; icon: typeof Wind; children: React.ReactNode; className?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`glass rounded-3xl p-5 ${className}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-dim)]">
        <Icon size={13} />
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </motion.div>
  );
}

/* ---------------- wind compass ---------------- */

export function WindCompass({ speed, deg, gusts, unit, delay = 0 }: {
  speed: number; deg: number; gusts: number; unit: string; delay?: number;
}) {
  const { t } = useTranslation();
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  return (
    <Panel title={t('weather.wind')} icon={Wind} delay={delay}>
      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            {ticks.map((t) => {
              const major = t % 45 === 0;
              const rad = (t - 90) * (Math.PI / 180);
              const r1 = major ? 76 : 82;
              return (
                <line
                  key={t}
                  x1={100 + Math.cos(rad) * r1} y1={100 + Math.sin(rad) * r1}
                  x2={100 + Math.cos(rad) * 90} y2={100 + Math.sin(rad) * 90}
                  stroke={major ? 'rgba(125,242,255,.5)' : 'rgba(255,255,255,.14)'}
                  strokeWidth={major ? 2 : 1}
                />
              );
            })}
            <circle cx="100" cy="100" r="66" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
            {[[t('weather.compassN'), 0], [t('weather.compassE'), 90], [t('weather.compassS'), 180], [t('weather.compassW'), 270]].map(([label, a], idx) => {
              const rad = ((a as number) - 90) * (Math.PI / 180);
              return (
                <text
                  key={label as string}
                  x={100 + Math.cos(rad) * 56} y={100 + Math.sin(rad) * 56 + 4}
                  textAnchor="middle" fontSize="13" fontWeight="700"
                  fill={idx === 0 ? '#7df2ff' : 'rgba(255,255,255,.45)'}
                >
                  {label}
                </text>
              );
            })}
            <motion.g
              animate={{ rotate: deg }}
              initial={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 55, damping: 14 }}
              style={{ transformOrigin: '100px 100px' }}
            >
              <path d="M100 34 L112 96 L100 88 L88 96 Z" fill="url(#windGrad)" />
              <path d="M100 166 L112 104 L100 112 L88 104 Z" fill="rgba(255,255,255,.22)" />
            </motion.g>
            <defs>
              <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7df2ff" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="7" fill="#0a1020" stroke="#7df2ff" strokeWidth="2" />
          </svg>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-4xl font-bold">{Math.round(speed)}</span>
            <span className="text-sm text-[var(--text-dim)]">{unit}</span>
          </div>
          <div className="mt-1 text-sm font-semibold text-aqua-300">{t(windLabelKey(speed))}</div>
          <div className="mt-3 space-y-1 text-xs text-[var(--text-dim)]">
            <div>{t('weather.direction')} · <b className="text-[var(--text)]">{dirLabel(t, deg)} ({Math.round(deg)}°)</b></div>
            <div>{t('dash.gustsInline')} · <b className="text-[var(--text)]">{Math.round(gusts)} {unit}</b></div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------- sun arc ---------------- */

export function SunArc({ day, utcOffset, delay = 0 }: {
  day: DayPoint; utcOffset: number; delay?: number;
}) {
  const { t } = useTranslation();
  const toMin = (iso: string) => {
    if (!iso) return 0;
    return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  };
  const now = new Date(Date.now() + utcOffset * 1000);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const rise = toMin(day.sunrise);
  const set = toMin(day.sunset);
  const progress = Math.max(0, Math.min(1, (nowMin - rise) / Math.max(1, set - rise)));
  const isDay = nowMin >= rise && nowMin <= set;

  const x = 20 + progress * 260;
  const y = 100 - Math.sin(progress * Math.PI) * 68;
  const hours = Math.floor((day.daylight ?? 0) / 3600);
  const mins = Math.round((((day.daylight ?? 0) % 3600) / 60));

  return (
    <Panel title={t('dash.sun')} icon={Sun} delay={delay}>
      <svg viewBox="0 0 300 120" className="w-full">
        <defs>
          <linearGradient id="sunPath" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <line x1="10" y1="100" x2="290" y2="100" stroke="rgba(255,255,255,.12)" strokeDasharray="3 5" />
        <path d="M20 100 Q150 -34 280 100" fill="none" stroke="url(#sunPath)" strokeWidth="2.5" strokeDasharray="4 4" />
        {isDay && (
          <>
            <circle cx={x} cy={y} r="22" fill="url(#sunGlow)" opacity="0.75" />
            <motion.circle
              cx={x} cy={y} fill="#fbbf24"
              initial={{ r: 8 }}
              animate={{ r: [8, 9.5, 8] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
          </>
        )}
        <text x="20" y="116" fontSize="10" fill="var(--text-dim)" textAnchor="middle">{day.sunrise.slice(11, 16)}</text>
        <text x="280" y="116" fontSize="10" fill="var(--text-dim)" textAnchor="middle">{day.sunset.slice(11, 16)}</text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-[var(--text-dim)]">{t('dash.daylight')}</span>
        <span className="font-mono font-bold text-amber-300">{hours} {t('units.hour')} {mins} {t('units.minute')}</span>
      </div>
    </Panel>
  );
}

/* ---------------- air quality ---------------- */

const POLLUTANTS: [string, string, number][] = [
  ['pm2_5', 'PM2.5', 25],
  ['pm10', 'PM10', 50],
  ['nitrogen_dioxide', 'NO₂', 200],
  ['ozone', 'O₃', 120],
  ['sulphur_dioxide', 'SO₂', 350],
];

export function AirQuality({ air, delay = 0 }: { air: ForecastBundle['air']; delay?: number }) {
  const { t } = useTranslation();
  const c = air?.current;
  const aqi = c?.european_aqi ?? null;
  const info = aqiInfo(aqi);

  return (
    <Panel title={t('dash.airQuality')} icon={Leaf} delay={delay}>
      {c ? (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-mono text-4xl font-bold" style={{ color: info.color }}>
                {Math.round(aqi ?? 0)}
              </div>
              <div className="text-xs text-[var(--text-dim)]">European AQI</div>
            </div>
            <div
              className="rounded-full px-3.5 py-1.5 text-xs font-bold"
              style={{ background: `${info.color}1f`, color: info.color, border: `1px solid ${info.color}44` }}
            >
              {t(info.labelKey)}
            </div>
          </div>
          <div className="mt-3">
            <Meter pct={info.pct} color={info.color} />
          </div>
          <div className="mt-4 space-y-2.5">
            {POLLUTANTS.map(([key, label, limit]) => {
              const v = c[key];
              if (v == null) return null;
              const pct = Math.min(100, (v / limit) * 100);
              const color = pct > 100 ? '#f43f5e' : pct > 66 ? '#fb923c' : pct > 33 ? '#fbbf24' : '#4ade80';
              return (
                <div key={key}>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-dim)]">{label}</span>
                    <span className="font-mono font-semibold">{v.toFixed(1)} µg/m³</span>
                  </div>
                  <div className="mt-1"><Meter pct={pct} color={color} height={4} /></div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-6 text-center text-sm text-[var(--text-dim)]">
          {t('dash.airNoData')}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- uv + comfort + pressure ---------------- */

export function UVPanel({ uv, uvMax, delay = 0 }: { uv: number; uvMax: number; delay?: number }) {
  const { t } = useTranslation();
  const info = uvInfo(uv);
  return (
    <Panel title={t('weather.uvIndex')} icon={Sun} delay={delay}>
      <div className="flex items-end justify-between">
        <div className="font-mono text-4xl font-bold" style={{ color: info.color }}>{uv.toFixed(1)}</div>
        <div className="text-right">
          <div className="text-sm font-bold" style={{ color: info.color }}>{t(info.labelKey)}</div>
          <div className="text-[11px] text-[var(--text-dim)]">{t('dash.uvMaxToday')} {uvMax.toFixed(1)}</div>
        </div>
      </div>
      <div className="mt-3"><Meter pct={info.pct} color={info.color} /></div>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--text-dim)]">
        <span>0</span><span>3</span><span>6</span><span>8</span><span>11+</span>
      </div>
    </Panel>
  );
}

export function ComfortPanel({ temp, humidity, wind, delay = 0 }: {
  temp: number; humidity: number; wind: number; delay?: number;
}) {
  const { t } = useTranslation();
  const c = comfortIndex(temp, humidity, wind);
  const circumference = 2 * Math.PI * 42;

  return (
    <Panel title={t('dash.comfortIndex')} icon={Activity} delay={delay}>
      <div className="flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none" stroke={c.color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * (1 - c.score / 100) }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: `drop-shadow(0 0 8px ${c.color}88)` }}
            />
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <div className="font-mono text-2xl font-bold">{c.score}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--text-dim)]">{t('dash.outOf100')}</div>
          </div>
        </div>
        <div>
          <div className="text-lg font-bold" style={{ color: c.color }}>{t(c.labelKey)}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-dim)]">
            {t('dash.comfortHint')}
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function PressurePanel({ hours, current, delay = 0 }: {
  hours: HourPoint[]; current: number; delay?: number;
}) {
  const { t } = useTranslation();
  const series = hours.map((h) => h.pressure);
  const trend = pressureTrend(series, Math.min(6, series.length - 1));
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const color = trend === 'up' ? '#4ade80' : trend === 'down' ? '#fb923c' : '#94a3c4';
  const text = trend === 'up' ? t('weather.trendUp')
    : trend === 'down' ? t('weather.trendDown') : t('weather.trendStable');

  const min = Math.min(...series.filter((v): v is number => v != null));
  const max = Math.max(...series.filter((v): v is number => v != null));
  const points = series.slice(0, 24).map((v, i) => {
    const y = 40 - (((v ?? min) - min) / Math.max(1, max - min)) * 32;
    return `${(i / 23) * 100},${y}`;
  }).join(' ');

  return (
    <Panel title={t('weather.pressure')} icon={Gauge} delay={delay}>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-4xl font-bold">{Math.round(current)}</span>
          <span className="text-sm text-[var(--text-dim)]">{t('units.hpa')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color }}>
          <TrendIcon size={16} />
        </div>
      </div>
      <svg viewBox="0 0 100 44" preserveAspectRatio="none" className="mt-3 h-12 w-full">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 text-xs text-[var(--text-dim)]">{text}</div>
    </Panel>
  );
}

/* ---------------- metric tiles ---------------- */

export function MetricTiles({ data, hours, delay = 0 }: {
  data: ForecastBundle; hours: HourPoint[]; delay?: number;
}) {
  const { t } = useTranslation();
  const c = data.forecast.current;
  const h = data.forecast.hourly;
  const idx = 0;
  const nowHour = hours[idx];

  const tiles = [
    { icon: Droplets, label: t('weather.humidity'), value: `${c.relative_humidity_2m}%`, color: '#4ade80' },
    {
      icon: Thermometer, label: t('weather.dewPoint'),
      value: `${Math.round(nowHour?.temp != null ? (h.dew_point_2m?.[0] ?? 0) : 0)}°`,
      color: '#22d3ee',
    },
    { icon: Cloud, label: t('weather.cloudiness'), value: `${c.cloud_cover}%`, color: '#94a3c4' },
    {
      icon: Eye, label: t('weather.visibility'),
      value: `${Math.round((h.visibility?.[0] ?? 0) / 1000)} ${t('units.km')}`, color: '#c084fc',
    },
    {
      icon: Zap, label: 'CAPE',
      value: `${Math.round(h.cape?.[0] ?? 0)} ${t('dash.jkg')}`, color: '#facc15',
    },
    {
      icon: Timer, label: t('weather.surfacePressure'),
      value: `${Math.round(Number(c.surface_pressure))}`, color: '#a78bfa',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + i * 0.05, duration: 0.45 }}
          className="glass card-hover rounded-2xl p-4"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            <t.icon size={12} style={{ color: t.color }} />
            <span className="truncate">{t.label}</span>
          </div>
          <div className="mt-2 font-mono text-xl font-bold">{t.value}</div>
        </motion.div>
      ))}
    </div>
  );
}
