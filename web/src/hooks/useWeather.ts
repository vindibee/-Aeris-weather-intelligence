import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type ForecastBundle, type GeoResult, type SavedLocation } from '../lib/api';
import { useApp } from '../lib/store';

export function useForecast(lat: number, lon: number) {
  const units = useApp((s) => s.units);
  return useQuery<ForecastBundle>({
    queryKey: ['forecast', lat.toFixed(3), lon.toFixed(3), units],
    queryFn: () => api.forecast(lat, lon, units),
    refetchInterval: 10 * 60_000,
  });
}

export function useSavedLocations() {
  return useQuery<SavedLocation[]>({
    queryKey: ['locations'],
    queryFn: async () => (await api.locations()).locations,
  });
}

export function useLocationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['locations'] });

  const add = useMutation({
    mutationFn: (g: Omit<GeoResult, 'id'> & { id?: number }) =>
      api.addLocation({
        name: g.name, country: g.country, admin1: g.admin1,
        lat: g.lat, lon: g.lon, timezone: g.timezone ?? null,
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.removeLocation(id),
    onSuccess: invalidate,
  });

  return { add, remove };
}

/** Current conditions for every saved location, in one upstream call. */
export function useLocationsWeather(locations: SavedLocation[] | undefined) {
  const units = useApp((s) => s.units);
  const key = (locations ?? []).map((l) => `${l.lat},${l.lon}`).join(';');

  return useQuery({
    queryKey: ['bulk', key, units],
    queryFn: async () => {
      if (!locations?.length) return [];
      const res = await api.bulk(locations.map((l) => ({ lat: l.lat, lon: l.lon })), units);
      return res.points;
    },
    enabled: !!locations?.length,
    refetchInterval: 10 * 60_000,
  });
}

export function useDebounced<T>(value: T, delay = 320): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useGeocode(term: string) {
  const q = useDebounced(term.trim(), 300);
  // через useTranslation, а не currentLanguage(): нужен ре-рендер при смене
  // языка, иначе ключ запроса останется прежним и список не обновится
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'ru';
  return useQuery<GeoResult[]>({
    // язык в ключе: при переключении список городов должен перезапроситься
    queryKey: ['geocode', q, lang],
    queryFn: async () => (await api.geocode(q, lang)).results,
    enabled: q.length >= 2,
    staleTime: 60 * 60_000,
  });
}

export function useRadar() {
  return useQuery({
    queryKey: ['radar'],
    queryFn: () => api.radar(),
    refetchInterval: 5 * 60_000,
  });
}

export interface HourPoint {
  time: string;
  iso: string;
  hour: number;
  temp: number | null;
  feels: number | null;
  precipProb: number | null;
  precip: number | null;
  wind: number | null;
  gusts: number | null;
  dir: number | null;
  humidity: number | null;
  pressure: number | null;
  clouds: number | null;
  uv: number | null;
  code: number | null;
  isDay: number | null;
  isNow: boolean;
}

/** Slice the hourly arrays into a chart-ready window starting at the current hour. */
export function useHourly(data: ForecastBundle | undefined, hours = 48): HourPoint[] {
  return useMemo(() => {
    if (!data) return [];
    const h = data.forecast.hourly;
    const nowMs = Date.now() + data.forecast.utc_offset_seconds * 1000;
    const nowIso = new Date(nowMs).toISOString().slice(0, 13);

    let start = h.time.findIndex((t) => t.slice(0, 13) >= nowIso);
    if (start < 0) start = 0;

    return h.time.slice(start, start + hours).map((iso, i) => {
      const idx = start + i;
      const d = new Date(iso);
      return {
        iso,
        time: `${String(d.getHours()).padStart(2, '0')}:00`,
        hour: d.getHours(),
        temp: h.temperature_2m?.[idx] ?? null,
        feels: h.apparent_temperature?.[idx] ?? null,
        precipProb: h.precipitation_probability?.[idx] ?? null,
        precip: h.precipitation?.[idx] ?? null,
        wind: h.wind_speed_10m?.[idx] ?? null,
        gusts: h.wind_gusts_10m?.[idx] ?? null,
        dir: h.wind_direction_10m?.[idx] ?? null,
        humidity: h.relative_humidity_2m?.[idx] ?? null,
        pressure: h.pressure_msl?.[idx] ?? null,
        clouds: h.cloud_cover?.[idx] ?? null,
        uv: h.uv_index?.[idx] ?? null,
        code: h.weather_code?.[idx] ?? null,
        isDay: h.is_day?.[idx] ?? null,
        isNow: i === 0,
      };
    });
  }, [data, hours]);
}

export interface DayPoint {
  iso: string;
  label: string;
  weekday: string;
  max: number | null;
  min: number | null;
  code: number | null;
  precipSum: number | null;
  precipProb: number | null;
  windMax: number | null;
  gustMax: number | null;
  windDir: number | null;
  uvMax: number | null;
  sunrise: string;
  sunset: string;
  daylight: number | null;
  isToday: boolean;
}

/*
 * Дни недели и месяцы даёт Intl, а не собственные массивы.
 *
 * Раньше здесь лежали русские сокращения, из-за чего календарь оставался
 * русским на всех языках. Intl знает формы для любой локали, включая
 * родительный падеж месяца там, где он нужен, — и не требует словаря.
 */
export function useDaily(data: ForecastBundle | undefined): DayPoint[] {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'ru';

  return useMemo(() => {
    if (!data) return [];
    const weekdayFmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
    const dateFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' });
    const d = data.forecast.daily;
    const todayIso = new Date(Date.now() + data.forecast.utc_offset_seconds * 1000)
      .toISOString().slice(0, 10);

    return d.time
      .map((iso, i) => {
        const dt = new Date(iso);
        return {
          iso,
          label: dateFmt.format(dt),
          weekday: weekdayFmt.format(dt),
          max: d.temperature_2m_max?.[i] ?? null,
          min: d.temperature_2m_min?.[i] ?? null,
          code: d.weather_code?.[i] ?? null,
          precipSum: d.precipitation_sum?.[i] ?? null,
          precipProb: d.precipitation_probability_max?.[i] ?? null,
          windMax: d.wind_speed_10m_max?.[i] ?? null,
          gustMax: d.wind_gusts_10m_max?.[i] ?? null,
          windDir: d.wind_direction_10m_dominant?.[i] ?? null,
          uvMax: d.uv_index_max?.[i] ?? null,
          sunrise: d.sunrise?.[i] ?? '',
          sunset: d.sunset?.[i] ?? '',
          daylight: d.daylight_duration?.[i] ?? null,
          isToday: iso === todayIso,
        };
      })
      .filter((day) => day.iso >= todayIso);
  }, [data, lang]);
}
