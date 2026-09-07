import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Shirt, PawPrint, ChevronDown } from 'lucide-react';
import type { ForecastBundle } from '../../lib/api';
import type { DayPoint, HourPoint } from '../../hooks/useWeather';
import { useApp } from '../../lib/store';
import {
  carWashIndex, laundryIndex, petWalkIndex,
  LEVEL_COLOR, LEVEL_LABEL, type IndexResult,
} from '../../lib/indices';

/**
 * Бытовые индексы: автомойка, сушка белья, выгул питомцев.
 *
 * Ничего дополнительно не запрашиваем — всё считается из того же прогноза,
 * который уже загружен для обзора.
 */

function IndexCard({
  icon: Icon, title, result, accent, delay,
}: {
  icon: typeof Car;
  title: string;
  result: IndexResult;
  accent: string;
  delay: number;
}) {
  const [open, setOpen] = useState(false);
  const color = LEVEL_COLOR[result.level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass overflow-hidden rounded-3xl"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-5 text-left transition hover:bg-white/[0.03]"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
            style={{ background: `${accent}1a`, border: `1px solid ${accent}33` }}
          >
            <Icon size={19} style={{ color: accent }} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">{title}</h3>
              <span
                className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color, background: `${color}1a`, border: `1px solid ${color}44` }}
              >
                {LEVEL_LABEL[result.level]}
              </span>
              <ChevronDown
                size={15}
                className="shrink-0 text-[var(--text-dim)] transition-transform duration-300"
                style={{ transform: open ? 'rotate(180deg)' : 'none' }}
              />
            </div>

            <div className="mt-1.5 text-base font-extrabold leading-tight" style={{ color }}>
              {result.verdict}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">{result.detail}</p>

            {/* шкала оценки */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${result.score}%` }}
                transition={{ delay: delay + 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-1.5 border-t border-white/8 px-5 py-4">
              {result.notes.map((n) => (
                <li key={n} className="flex gap-2 text-xs leading-relaxed text-[var(--text-dim)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
                  {n}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function HouseholdIndices({
  data, days, hours,
}: {
  data: ForecastBundle | undefined;
  days: DayPoint[];
  hours: HourPoint[];
}) {
  const units = useApp((s) => s.units);

  const results = useMemo(() => {
    const cur = data?.forecast?.current as Record<string, number> | undefined;
    if (!cur) return null;
    const u = { units };
    const now = hours[0];

    return {
      carWash: carWashIndex(
        days.slice(0, 3).map((d) => ({
          date: d.iso,
          precipProbMax: d.precipProb,
          precipSum: d.precipSum,
          windMax: d.windMax,
        })),
        u
      ),
      laundry: laundryIndex(
        {
          temp: cur.temperature_2m,
          humidity: cur.relative_humidity_2m,
          wind: cur.wind_speed_10m,
          precipProb: now?.precipProb ?? days[0]?.precipProb ?? null,
          isDay: !!cur.is_day,
        },
        u
      ),
      petWalk: petWalkIndex(
        {
          temp: cur.temperature_2m,
          feelsLike: cur.apparent_temperature,
          uv: now?.uv ?? days[0]?.uvMax ?? null,
          wind: cur.wind_speed_10m,
          precipProb: now?.precipProb ?? null,
          isDay: !!cur.is_day,
        },
        u
      ),
    };
  }, [data, days, hours, units]);

  if (!results) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Бытовые индексы</h2>
        <span className="text-xs text-[var(--text-dim)]">рассчитаны по текущему прогнозу</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <IndexCard
          icon={Car} title="Автомойка" accent="#38bdf8"
          result={results.carWash} delay={0}
        />
        <IndexCard
          icon={Shirt} title="Сушка белья" accent="#4ade80"
          result={results.laundry} delay={0.07}
        />
        <IndexCard
          icon={PawPrint} title="Выгул питомцев" accent="#fbbf24"
          result={results.petWalk} delay={0.14}
        />
      </div>
    </section>
  );
}
