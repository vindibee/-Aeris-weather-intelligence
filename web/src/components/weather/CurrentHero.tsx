import { motion } from 'framer-motion';
import {
  MapPin, Wind, Droplets, Gauge, Eye, Thermometer, CloudRain, Sunrise, Sunset,
  RefreshCw, Star, Check,
} from 'lucide-react';
import type { ForecastBundle } from '../../lib/api';
import { codeInfo, codeEmoji, tempColor, windDir, windLabel } from '../../lib/weather';
import { WeatherFX } from '../Atmosphere';
import type { DayPoint } from '../../hooks/useWeather';

interface Props {
  data: ForecastBundle;
  place: { name: string; country?: string | null; admin1?: string | null; lat: number; lon: number };
  today?: DayPoint;
  onRefresh: () => void;
  refreshing: boolean;
  saved: boolean;
  onSave: () => void;
  savePending: boolean;
}

const time = (iso: string) => (iso ? iso.slice(11, 16) : '—');

export default function CurrentHero({
  data, place, today, onRefresh, refreshing, saved, onSave, savePending,
}: Props) {
  const c = data.forecast.current;
  const u = data.forecast.current_units;
  const info = codeInfo(c.weather_code as number);
  const isDay = Number(c.is_day) === 1;
  const temp = Number(c.temperature_2m);
  const feels = Number(c.apparent_temperature);

  const localTime = new Date(Date.now() + data.forecast.utc_offset_seconds * 1000)
    .toISOString().slice(11, 16);

  const chips = [
    { icon: Thermometer, label: 'Ощущается', value: `${Math.round(feels)}${u.temperature_2m}` },
    { icon: Wind, label: `Ветер · ${windDir(c.wind_direction_10m as number)}`, value: `${Math.round(Number(c.wind_speed_10m))} ${u.wind_speed_10m}` },
    { icon: Droplets, label: 'Влажность', value: `${c.relative_humidity_2m}%` },
    { icon: Gauge, label: 'Давление', value: `${Math.round(Number(c.pressure_msl))} гПа` },
    { icon: CloudRain, label: 'Осадки', value: `${Number(c.precipitation).toFixed(1)} ${u.precipitation}` },
    { icon: Eye, label: 'Облачность', value: `${c.cloud_cover}%` },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[2rem] border border-white/10 p-6 sm:p-9"
      style={{
        background: `linear-gradient(135deg, ${info.gradient[0]} 0%, ${info.gradient[1]} 100%)`,
      }}
    >
      <WeatherFX sky={info.sky} className="absolute inset-0 h-full w-full opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/25 to-transparent" />

      {/* sun / moon orb */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-2xl"
        style={{ background: isDay ? 'radial-gradient(circle, rgba(255,214,120,.55), transparent 68%)' : 'radial-gradient(circle, rgba(180,205,255,.4), transparent 68%)' }}
      />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/85">
              <MapPin size={15} />
              <span className="text-sm font-semibold">
                {[place.name, place.admin1 !== place.name ? place.admin1 : null, place.country]
                  .filter(Boolean).join(', ')}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-white/60">
              <span className="font-mono">{place.lat.toFixed(3)}, {place.lon.toFixed(3)}</span>
              <span>·</span>
              <span>местное время {localTime}</span>
              <span>·</span>
              <span>{Math.round(data.forecast.elevation)} м н.у.м.</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={saved || savePending}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold backdrop-blur-md transition ${
                saved
                  ? 'border-lime-300/40 bg-lime-400/15 text-lime-200'
                  : 'border-white/25 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {saved ? <Check size={14} /> : <Star size={14} />}
              {saved ? 'Сохранено' : 'В избранное'}
            </button>
            <button
              onClick={onRefresh}
              className="rounded-full border border-white/25 bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
              title="Обновить"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
          <div className="flex items-center gap-6">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-7xl leading-none drop-shadow-2xl sm:text-8xl"
            >
              {codeEmoji(c.weather_code as number, isDay)}
            </motion.div>
            <div>
              <div className="flex items-start">
                <motion.span
                  key={temp}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-mono text-7xl font-bold leading-none tracking-tighter text-white sm:text-8xl"
                >
                  {Math.round(temp)}
                </motion.span>
                <span className="mt-2 text-3xl font-light text-white/70">{u.temperature_2m}</span>
              </div>
              <div className="mt-2 text-lg font-semibold text-white/95">{info.label}</div>
              {today && (
                <div className="mt-1 flex items-center gap-3 text-sm text-white/70">
                  <span style={{ color: tempColor(today.max ?? 0, data.units) }}>
                    ↑ {Math.round(today.max ?? 0)}°
                  </span>
                  <span style={{ color: tempColor(today.min ?? 0, data.units) }}>
                    ↓ {Math.round(today.min ?? 0)}°
                  </span>
                  <span className="text-white/50">{windLabel(Number(c.wind_speed_10m))}</span>
                </div>
              )}
            </div>
          </div>

          {today && (
            <div className="flex gap-5 text-white/85">
              <div className="flex items-center gap-2.5">
                <Sunrise size={19} className="text-amber-300" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">Восход</div>
                  <div className="font-mono text-base font-semibold">{time(today.sunrise)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Sunset size={19} className="text-orange-300" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">Закат</div>
                  <div className="font-mono text-base font-semibold">{time(today.sunset)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {chips.map((chip, i) => (
            <motion.div
              key={chip.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.055, duration: 0.5 }}
              className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md transition hover:bg-white/15"
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/60">
                <chip.icon size={12} />
                <span className="truncate">{chip.label}</span>
              </div>
              <div className="mt-1.5 font-mono text-lg font-bold text-white">{chip.value}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
