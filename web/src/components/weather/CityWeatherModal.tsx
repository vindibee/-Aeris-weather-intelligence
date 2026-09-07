import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  X, Wind, Droplets, Gauge, Sun, Thermometer, Eye, CloudRain, Shirt, MapPin,
} from 'lucide-react';
import { api, type ForecastBundle } from '../../lib/api';
import { useApp } from '../../lib/store';
import { codeEmoji, codeInfo, tempColor } from '../../lib/weather';
import { pickOutfit, SLOT_TITLES, type OutfitSlot } from '../../lib/outfit';
import { LoadingPanel, ErrorPanel } from '../ui';
import Avatar3D from '../wardrobe/Avatar3D';

export interface ModalCity {
  name: string;
  country?: string | null;
  lat: number;
  lon: number;
}

/** Индекс часа, ближайшего к текущему моменту, в почасовых рядах провайдера. */
function currentHourIndex(times: string[] | undefined): number {
  if (!times?.length) return -1;
  const now = Date.now();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - now);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

const SLOT_ORDER: OutfitSlot[] = ['outer', 'mid', 'legs', 'head', 'shoes', 'accessory'];

export default function CityWeatherModal({
  city, onClose,
}: {
  city: ModalCity;
  onClose: () => void;
}) {
  const units = useApp((s) => s.units);
  const user = useApp((s) => s.user);

  const { data, isLoading, error, refetch } = useQuery<ForecastBundle>({
    queryKey: ['city-modal', city.lat.toFixed(3), city.lon.toFixed(3), units],
    queryFn: () => api.forecast(city.lat, city.lon, units, 3),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const cur = data?.forecast?.current as Record<string, number> | undefined;
  const hourly = data?.forecast?.hourly;
  const hourIdx = useMemo(() => currentHourIndex(hourly?.time), [hourly?.time]);

  const uv = hourIdx >= 0 ? (hourly?.uv_index?.[hourIdx] ?? null) : null;
  const precipProb = hourIdx >= 0 ? (hourly?.precipitation_probability?.[hourIdx] ?? null) : null;

  const outfit = useMemo(() => {
    if (!cur) return null;
    return pickOutfit({
      temp: cur.temperature_2m,
      feelsLike: cur.apparent_temperature,
      wind: cur.wind_speed_10m,
      uv,
      precipProb,
      precipMm: cur.precipitation,
      isDay: !!cur.is_day,
      units,
    });
  }, [cur, uv, precipProb, units]);

  const info = codeInfo(cur?.weather_code);
  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const windUnit = units === 'imperial' ? 'миль/ч' : 'км/ч';

  const grouped = useMemo(() => {
    if (!outfit) return [];
    return SLOT_ORDER
      .map((slot) => ({ slot, items: outfit.items.filter((i) => i.slot === slot) }))
      .filter((g) => g.items.length);
  }, [outfit]);

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-ink-950/80 p-4 backdrop-blur-md"
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

        <div className="flex items-center gap-2 text-xs text-aqua-300">
          <MapPin size={13} />
          <span className="font-mono">{city.lat.toFixed(3)}, {city.lon.toFixed(3)}</span>
        </div>
        <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{city.name}</h2>
        {city.country && <p className="text-sm text-[var(--text-dim)]">{city.country}</p>}

        {isLoading && <div className="mt-6"><LoadingPanel label="Запрашиваем погоду" /></div>}

        {error && (
          <div className="mt-6">
            <ErrorPanel
              message={(error as Error).message ?? 'Не удалось получить прогноз'}
              onRetry={() => refetch()}
            />
          </div>
        )}

        {cur && outfit && (
          <div className="mt-6 grid gap-7 lg:grid-cols-[1.05fr_1fr]">
            {/* ---------- погода ---------- */}
            <div>
              <div className="flex items-center gap-4">
                <span className="text-6xl">{codeEmoji(cur.weather_code, !!cur.is_day)}</span>
                <div>
                  <div
                    className="font-mono text-5xl font-bold leading-none"
                    style={{ color: tempColor(cur.temperature_2m, units) }}
                  >
                    {Math.round(cur.temperature_2m)}{tempUnit}
                  </div>
                  <div className="mt-1.5 text-sm text-[var(--text-dim)]">{info.label}</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    ощущается как {Math.round(cur.apparent_temperature)}{tempUnit}
                  </div>
                </div>
              </div>

              {data?.fallback && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-snug text-amber-200">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  <span>
                    В самой точке наблюдений нет — данные ближайшей станции,
                    в {data.fallback.distanceKm} км.
                  </span>
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
                {[
                  { icon: Wind, label: 'Ветер', value: `${Math.round(cur.wind_speed_10m)} ${windUnit}`, color: '#7df2ff' },
                  { icon: Droplets, label: 'Влажность', value: `${Math.round(cur.relative_humidity_2m)}%`, color: '#4ade80' },
                  { icon: Gauge, label: 'Давление', value: `${Math.round(cur.pressure_msl)} гПа`, color: '#a78bfa' },
                  { icon: Sun, label: 'UV-индекс', value: uv == null ? '—' : uv.toFixed(1), color: '#fbbf24' },
                  { icon: CloudRain, label: 'Осадки', value: precipProb == null ? '—' : `${Math.round(precipProb)}%`, color: '#38bdf8' },
                  { icon: Thermometer, label: 'Порывы', value: `${Math.round(cur.wind_gusts_10m ?? 0)} ${windUnit}`, color: '#f472b6' },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-white/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                      <m.icon size={11} style={{ color: m.color }} />
                      {m.label}
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* прогноз на ближайшие дни */}
              {data?.forecast?.daily?.time && (
                <div className="mt-4 flex gap-2">
                  {data.forecast.daily.time.slice(0, 3).map((d: string, i: number) => (
                    <div key={d} className="flex-1 rounded-xl bg-white/5 p-2.5 text-center">
                      <div className="text-[10px] uppercase text-[var(--text-dim)]">
                        {i === 0 ? 'сегодня' : new Date(d).toLocaleDateString('ru-RU', { weekday: 'short' })}
                      </div>
                      <div className="mt-1 text-lg">
                        {codeEmoji(data.forecast.daily.weather_code?.[i] ?? 0, true)}
                      </div>
                      <div className="mt-0.5 font-mono text-xs font-bold">
                        {Math.round(data.forecast.daily.temperature_2m_max?.[i] ?? 0)}°
                        <span className="ml-1 text-[var(--text-dim)]">
                          {Math.round(data.forecast.daily.temperature_2m_min?.[i] ?? 0)}°
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- Одеватор ---------- */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Shirt size={17} className="text-aqua-300" />
                <h3 className="text-lg font-extrabold">Одеватор</h3>
                <span className="ml-auto rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  {outfit.title}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-dim)]">
                Набор собран по ощущаемой температуре {outfit.basis}{tempUnit === '°F' ? ' °C' : ' °C'}
                {user?.gender ? '' : ' · пол не указан, показаны оба варианта'}
              </p>

              <Avatar3D
                outfit={outfit}
                gender={user?.gender ?? null}
                className="mt-2 h-[230px] w-full"
              />

              <div className="mt-3 space-y-2">
                {grouped.map((g) => (
                  <div key={g.slot} className="rounded-xl bg-white/5 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                      {SLOT_TITLES[g.slot]}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {g.items.map((i) => (
                        <span key={i.label} className="text-[13px] font-semibold" title={i.why}>
                          <span className="mr-1">{i.icon}</span>{i.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <ul className="mt-3 space-y-1.5">
                {outfit.advice.map((a) => (
                  <li key={a} className="flex gap-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
                    <Eye size={13} className="mt-0.5 shrink-0 text-aqua-400" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  // портал в body: модалка не должна зависеть от stacking context секции,
  // из которой её открыли (у героя лендинга свой z-index и трансформы)
  return createPortal(modal, document.body);
}
