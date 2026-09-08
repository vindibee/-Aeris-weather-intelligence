import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Wind, Droplets, Gauge, Sun, Thermometer, CloudRain, Shirt, MapPin, Eye,
} from 'lucide-react';
import { api, type ForecastBundle } from '../../lib/api';
import { useApp } from '../../lib/store';
import { useDaily, useHourly } from '../../hooks/useWeather';
import { codeLabelKey, codeEmoji, codeInfo, tempColor } from '../../lib/weather';
import { pickOutfit, SLOT_TITLES, type OutfitSlot } from '../../lib/outfit';
import { LoadingPanel, ErrorPanel } from '../ui';
import Avatar3D from '../wardrobe/Avatar3D';
import HouseholdIndices from '../weather/HouseholdIndices';
import FavouriteButton from '../weather/FavouriteButton';

/**
 * Сводка по городу: погода, бытовые индексы и «Одеватор» в одном месте.
 *
 * Единственная реализация этого экрана на всё приложение. Раньше индексы жили
 * только в кабинете, а гардероб — только в модалке глобуса, и до них надо было
 * идти разными путями. Теперь любой клик по городу — с лендинга, с карты, из
 * поиска или из избранного — открывает один и тот же компонент.
 *
 * Здесь только композиция и разметка: расчёты живут в lib/outfit и lib/indices,
 * сетевой слой — в lib/api, избранное — в services/favourites.
 */

export interface CityRef {
  name: string;
  country?: string | null;
  admin1?: string | null;
  lat: number;
  lon: number;
  timezone?: string | null;
}

const SLOT_ORDER: OutfitSlot[] = ['outer', 'mid', 'legs', 'head', 'shoes', 'accessory'];

export default function CityDashboard({ city }: { city: CityRef }) {
  const { t } = useTranslation();
  const units = useApp((s) => s.units);
  const user = useApp((s) => s.user);

  const { data, isLoading, error, refetch } = useQuery<ForecastBundle>({
    queryKey: ['city-dashboard', city.lat.toFixed(3), city.lon.toFixed(3), units],
    queryFn: () => api.forecast(city.lat, city.lon, units, 7),
    staleTime: 5 * 60_000,
  });

  const hours = useHourly(data, 48);
  const days = useDaily(data);

  const cur = data?.forecast?.current as Record<string, number> | undefined;
  const now = hours[0];

  const outfit = useMemo(() => {
    if (!cur) return null;
    return pickOutfit({
      temp: cur.temperature_2m,
      feelsLike: cur.apparent_temperature,
      wind: cur.wind_speed_10m,
      uv: now?.uv ?? null,
      precipProb: now?.precipProb ?? null,
      precipMm: cur.precipitation,
      isDay: !!cur.is_day,
      units,
    });
  }, [cur, now, units]);

  const grouped = useMemo(() => {
    if (!outfit) return [];
    return SLOT_ORDER
      .map((slot) => ({ slot, items: outfit.items.filter((i) => i.slot === slot) }))
      .filter((g) => g.items.length);
  }, [outfit]);

  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const windUnit = units === 'imperial' ? t('units.mph') : t('units.kmh');
  const info = codeInfo(cur?.weather_code);

  return (
    <div>
      {/* ---------- шапка ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-aqua-300">
            <MapPin size={13} />
            <span className="font-mono">{city.lat.toFixed(3)}, {city.lon.toFixed(3)}</span>
          </div>
          <h2 className="mt-1 truncate text-3xl font-extrabold tracking-tight">{city.name}</h2>
          {(city.country || city.admin1) && (
            <p className="text-sm text-[var(--text-dim)]">
              {[city.admin1, city.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <FavouriteButton city={city} size="lg" showLabel />
      </div>

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
        <>
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
                  <div className="mt-1.5 text-sm text-[var(--text-dim)]">{t(codeLabelKey(info))}</div>
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
                  { icon: Gauge, label: t('weather.pressure'), value: `${Math.round(cur.pressure_msl)} ${t('units.hpa')}`, color: '#a78bfa' },
                  { icon: Sun, label: 'UV-индекс', value: now?.uv == null ? '—' : now.uv.toFixed(1), color: '#fbbf24' },
                  { icon: CloudRain, label: 'Осадки', value: now?.precipProb == null ? '—' : `${Math.round(now.precipProb)}%`, color: '#38bdf8' },
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

              {!!days.length && (
                <div className="mt-4 flex gap-2">
                  {days.slice(0, 4).map((d, i) => (
                    <div key={d.iso} className="flex-1 rounded-xl bg-white/5 p-2.5 text-center">
                      <div className="text-[10px] uppercase text-[var(--text-dim)]">
                        {i === 0 ? 'сегодня' : d.weekday}
                      </div>
                      <div className="mt-1 text-lg">{codeEmoji(d.code ?? 0, true)}</div>
                      <div className="mt-0.5 font-mono text-xs font-bold">
                        {Math.round(d.max ?? 0)}°
                        <span className="ml-1 text-[var(--text-dim)]">{Math.round(d.min ?? 0)}°</span>
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
                Набор собран по ощущаемой температуре {outfit.basis} °C
                {user?.gender ? '' : ' · пол не указан, показаны оба варианта'}
              </p>

              <Avatar3D
                outfit={outfit}
                gender={user?.gender ?? null}
                className="mt-2 h-[240px] w-full"
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

          {/* ---------- бытовые индексы: тот же компонент, что и в кабинете ---------- */}
          <div className="mt-7">
            <HouseholdIndices data={data} days={days} hours={hours} />
          </div>
        </>
      )}
    </div>
  );
}
