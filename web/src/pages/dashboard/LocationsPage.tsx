import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, MapPin, Wind, Droplets, Plus, Search, Loader2, ArrowRight, Star,
} from 'lucide-react';
import { useApp, fromGeo } from '../../lib/store';
import {
  useGeocode, useLocationMutations, useLocationsWeather, useSavedLocations,
} from '../../hooks/useWeather';
import { codeEmoji, codeInfo, tempColor } from '../../lib/weather';
import { LoadingPanel } from '../../components/ui';
import { useCityDashboard } from '../../components/city/CityDashboardProvider';
import type { GeoResult, SavedLocation } from '../../lib/api';

function AddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const { data: results, isFetching } = useGeocode(term);
  const { add } = useLocationMutations();

  const pick = async (g: GeoResult) => {
    try {
      await add.mutateAsync(g);
      onClose();
      setTerm('');
    } catch { /* surfaced below */ }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink-950/75 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="glass-strong fixed left-1/2 top-24 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded-3xl p-6 shadow-card"
          >
            <h3 className="text-lg font-bold">Добавить локацию</h3>
            <div className="glass mt-4 flex items-center gap-3 rounded-2xl px-4 py-3">
              <Search size={16} className="text-[var(--text-dim)]" />
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Город, посёлок, регион…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-dim)]"
              />
              {isFetching && <Loader2 size={15} className="animate-spin text-aqua-400" />}
            </div>

            {add.isError && (
              <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {(add.error as Error).message}
              </p>
            )}

            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {results?.map((g) => (
                <button
                  key={`${g.id}-${g.lat}`}
                  onClick={() => pick(g)}
                  disabled={add.isPending}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/7 disabled:opacity-50"
                >
                  <MapPin size={15} className="shrink-0 text-aqua-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{g.name}</div>
                    <div className="truncate text-xs text-[var(--text-dim)]">
                      {[g.admin1, g.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <Plus size={15} className="shrink-0 text-[var(--text-dim)]" />
                </button>
              ))}
              {term.length >= 2 && !isFetching && !results?.length && (
                <p className="py-6 text-center text-sm text-[var(--text-dim)]">Ничего не найдено</p>
              )}
            </div>

            <button onClick={onClose} className="glass mt-4 w-full rounded-2xl py-2.5 text-sm font-semibold">
              Закрыть
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function LocationsPage() {
  const navigate = useNavigate();
  const units = useApp((s) => s.units);
  const setPlace = useApp((s) => s.setPlace);
  const { data: locations, isLoading } = useSavedLocations();
  const { data: weather, isFetching } = useLocationsWeather(locations);
  const { remove } = useLocationMutations();
  const { openCity } = useCityDashboard();
  const [adding, setAdding] = useState(false);

  if (isLoading) return <LoadingPanel label="Загружаем ваши локации" />;

  // Клик по карточке открывает общую сводку — тот же экран, что с глобуса и
  // из поиска. Кнопка «Открыть в кабинете» осталась для перехода на обзор.
  const open = (l: SavedLocation) => openCity(l);

  const openInDashboard = (l: SavedLocation) => {
    setPlace(l);
    navigate('/app');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Мои локации</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            {locations?.length ?? 0} из 25 · данные обновляются каждые 10 минут
            {isFetching && <span className="ml-2 text-aqua-300">обновляем…</span>}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-5 py-3 text-sm font-bold text-ink-950 shadow-glow transition hover:scale-[1.03]"
        >
          <Plus size={17} />
          Добавить город
        </button>
      </div>

      {!locations?.length ? (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <Star size={34} className="text-amber-400" />
          <div>
            <p className="text-lg font-bold">Пока пусто</p>
            <p className="mt-1 text-sm text-[var(--text-dim)]">
              Добавьте города, за погодой в которых хотите следить
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-6 py-3 text-sm font-bold text-ink-950"
          >
            Добавить первый город
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {locations.map((l, i) => {
              const w = weather?.[i];
              const cur = w?.current;
              const daily = w?.daily;
              const info = codeInfo(cur?.weather_code);

              return (
                <motion.div
                  key={l.id}
                  layout
                  initial={{ opacity: 0, y: 22, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 p-5 transition hover:border-aqua-400/35"
                  style={{
                    background: `linear-gradient(140deg, ${info.gradient[0]}cc, ${info.gradient[1]}66)`,
                  }}
                >
                  <div className="absolute inset-0 bg-ink-950/45" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-white">{l.name}</h3>
                        <p className="truncate text-xs text-white/60">
                          {[l.admin1, l.country].filter(Boolean).join(', ') || `${l.lat.toFixed(2)}, ${l.lon.toFixed(2)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => remove.mutate(l.id)}
                        className="shrink-0 rounded-lg p-2 text-white/40 opacity-0 transition hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                        title="Удалить"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {cur ? (
                      <>
                        <div className="mt-4 flex items-end justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl">{codeEmoji(cur.weather_code, cur.is_day)}</span>
                            <div>
                              <div className="font-mono text-4xl font-bold text-white">
                                {Math.round(cur.temperature_2m)}°
                              </div>
                              <div className="text-xs text-white/70">{info.short}</div>
                            </div>
                          </div>
                          <div className="text-right text-xs text-white/70">
                            <div className="flex items-center justify-end gap-1">
                              <Wind size={11} />{Math.round(cur.wind_speed_10m)}
                            </div>
                            <div className="mt-1 flex items-center justify-end gap-1">
                              <Droplets size={11} />{cur.relative_humidity_2m}%
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-1.5">
                          {(daily?.time ?? []).slice(0, 3).map((d: string, k: number) => (
                            <div key={d} className="flex-1 rounded-xl bg-white/12 px-2 py-1.5 text-center backdrop-blur-sm">
                              <div className="text-[9px] uppercase text-white/55">
                                {k === 0 ? 'сег' : k === 1 ? 'завт' : 'послез'}
                              </div>
                              <div className="text-sm">{codeEmoji(daily.weather_code[k], true)}</div>
                              <div className="font-mono text-[11px] font-bold text-white">
                                {Math.round(daily.temperature_2m_max[k])}°
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 space-y-2">
                        <div className="skeleton h-12 w-2/3" />
                        <div className="skeleton h-10 w-full" />
                      </div>
                    )}

                    <button
                      onClick={() => open(l)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/12 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/22"
                    >
                      Открыть прогноз
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AddDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
