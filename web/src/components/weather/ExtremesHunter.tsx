import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Flame, Snowflake, Wind, Crosshair, Loader2, Info, MapPin, ArrowRight, Clock,
} from 'lucide-react';
import { api, type ExtremeKind, type ExtremesResponse } from '../../lib/api';
import { useApp } from '../../lib/store';
import { codeLabelKey, codeEmoji, codeInfo, tempColor } from '../../lib/weather';
import { LoadingPanel, Spinner } from '../ui';
import type { GlobeMarker } from '../Globe3D';

const Globe3D = lazy(() => import('../Globe3D'));

/**
 * «Телепорт»: находит текущий мировой экстремум и доворачивает глобус к нему.
 *
 * Оговорка из ответа сервера показывается прямо в карточке: экстремум ищется
 * среди опорной сети станций, а не по всей поверхности планеты — бесплатного
 * API для второго не существует.
 */

const KINDS: { key: ExtremeKind; label: string; icon: typeof Flame; color: string; hint: string }[] = [
  { key: 'hot', label: 'Самое жаркое', icon: Flame, color: '#fb923c', hint: 'максимум температуры' },
  { key: 'cold', label: 'Самое холодное', icon: Snowflake, color: '#7dd3fc', hint: 'минимум температуры' },
  { key: 'wind', label: 'Самое ветреное', icon: Wind, color: '#a78bfa', hint: 'максимум порывов' },
];

export default function ExtremesHunter() {
  const { t } = useTranslation();
  const units = useApp((s) => s.units);
  const setPlace = useApp((s) => s.setPlace);
  const [kind, setKind] = useState<ExtremeKind | null>(null);

  const { data, isFetching, error } = useQuery<ExtremesResponse>({
    queryKey: ['extremes', kind, units],
    queryFn: () => api.extremes(kind as ExtremeKind, units),
    enabled: !!kind,
    staleTime: 10 * 60_000,
  });

  const best = data?.best;
  const active = KINDS.find((k) => k.key === kind);

  const tempUnit = units === 'imperial' ? '°F' : '°C';
  const windUnit = units === 'imperial' ? 'миль/ч' : 'км/ч';

  const markers = useMemo<GlobeMarker[]>(() => {
    if (!best) return [];
    return [{
      lat: best.lat,
      lon: best.lon,
      label: best.name,
      value: kind === 'wind'
        ? `${Math.round(best.gusts ?? best.wind ?? 0)} ${windUnit}`
        : `${Math.round(best.temp)}${tempUnit}`,
      color: active?.color ?? '#7df2ff',
    }];
  }, [best, kind, active, tempUnit, windUnit]);

  const focus = useMemo(
    () => (best ? { lat: best.lat, lon: best.lon } : null),
    [best?.lat, best?.lon]
  );

  return (
    <section className="glass overflow-hidden rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Охотник за экстремумами</h2>
        <span className="text-xs text-[var(--text-dim)]">
          где на планете прямо сейчас предел
        </span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
        {/* ---------- глобус ---------- */}
        <div className="relative min-h-[300px]">
          <Suspense fallback={<div className="grid h-full place-items-center"><Spinner size={28} className="text-aqua-400" /></div>}>
            <Globe3D
              className="h-[300px] w-full sm:h-[340px]"
              markers={markers}
              showCities={false}
              enableZoom
              focus={focus}
              hint={kind ? false : 'Выберите экстремум справа'}
            />
          </Suspense>

          {isFetching && (
            <div className="glass pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold">
              <Loader2 size={13} className="animate-spin text-aqua-400" />
              Сканируем опорную сеть…
            </div>
          )}
        </div>

        {/* ---------- управление и карточка ---------- */}
        <div className="min-w-0">
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => {
              const on = kind === k.key;
              return (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={`group flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition ${
                    on ? 'bg-white/[0.06]' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.03]'
                  }`}
                  style={on ? { borderColor: `${k.color}66`, boxShadow: `0 0 24px -12px ${k.color}` } : undefined}
                >
                  <k.icon size={18} style={{ color: k.color }} />
                  <span className="text-xs font-bold leading-tight">{k.label}</span>
                  <span className="text-[10px] text-[var(--text-dim)]">{k.hint}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {!kind && (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mt-5 text-sm leading-relaxed text-[var(--text-dim)]"
              >
                Нажмите кнопку — сервер опросит опорную сеть метеостанций,
                а глобус плавно довернётся к найденной точке.
              </motion.p>
            )}

            {kind && isFetching && !best && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LoadingPanel label="Ищем экстремум" />
              </motion.div>
            )}

            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/5 p-4 text-sm text-rose-200"
              >
                {(error as Error).message ?? 'Не удалось получить данные'}
              </motion.p>
            )}

            {best && data && (
              <motion.div
                key={`${kind}-${best.name}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="text-4xl">{codeEmoji(best.code ?? 0, !!best.isDay)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-extrabold">{best.name}</h3>
                      {best.isGrid && (
                        <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                          узел сетки
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                      <MapPin size={11} />
                      {best.country} · {best.lat.toFixed(2)}, {best.lon.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Температура</div>
                    <div className="mt-0.5 font-mono text-lg font-bold" style={{ color: tempColor(best.temp, units) }}>
                      {Math.round(best.temp)}{tempUnit}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Порывы</div>
                    <div className="mt-0.5 font-mono text-lg font-bold">
                      {best.gusts == null ? '—' : Math.round(best.gusts)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Влажность</div>
                    <div className="mt-0.5 font-mono text-lg font-bold">
                      {best.humidity == null ? '—' : `${Math.round(best.humidity)}%`}
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs text-[var(--text-dim)]">
                  {t(codeLabelKey(codeInfo(best.code ?? 0)))}
                  {best.localTime && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Clock size={10} />
                      местное время {new Date(best.localTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>

                {best.blurb && (
                  <p className="mt-3 rounded-xl bg-white/5 px-3 py-2.5 text-[13px] leading-relaxed">
                    {best.blurb}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPlace({ name: best.name, country: best.country, lat: best.lat, lon: best.lon })}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-aqua-400 to-violet-500 px-3.5 py-2 text-xs font-bold text-ink-950 transition hover:scale-[1.03] active:scale-95"
                  >
                    <Crosshair size={13} />
                    Смотреть прогноз
                    <ArrowRight size={12} />
                  </button>
                  {!!data.runnersUp.length && (
                    <span className="text-[11px] text-[var(--text-dim)]">
                      следом: {data.runnersUp.slice(0, 2).map((r) => r.name).join(', ')}
                    </span>
                  )}
                </div>

                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-dim)]">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  {data.note}: опрошено {data.scanned} из {data.requested} точек.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
