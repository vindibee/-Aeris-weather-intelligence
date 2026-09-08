import { useMemo } from 'react';
import { localeTag } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Map as MapIcon } from 'lucide-react';
import { useApp } from '../../lib/store';
import {
  useDaily, useForecast, useHourly, useLocationMutations, useSavedLocations,
} from '../../hooks/useWeather';
import { ErrorPanel, LoadingPanel, Skeleton } from '../../components/ui';
import CurrentHero from '../../components/weather/CurrentHero';
import { DailyForecast, HourStrip, HourlyChart } from '../../components/weather/Charts';
import {
  AirQuality, ComfortPanel, MetricTiles, PressurePanel, SunArc, UVPanel, WindCompass,
} from '../../components/weather/Panels';
import HouseholdIndices from '../../components/weather/HouseholdIndices';
import ExtremesHunter from '../../components/weather/ExtremesHunter';

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[380px] w-full rounded-[2rem]" />
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[360px] rounded-3xl lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-3xl" />
      </div>
    </div>
  );
}

export default function Overview() {
  const { t } = useTranslation();
  const place = useApp((s) => s.place);
  const units = useApp((s) => s.units);
  const { data, isLoading, isFetching, error, refetch } = useForecast(place.lat, place.lon);
  const hours = useHourly(data, 72);
  const days = useDaily(data);

  const { data: saved } = useSavedLocations();
  const { add } = useLocationMutations();

  const isSaved = useMemo(
    () => !!saved?.some((l) => Math.abs(l.lat - place.lat) < 0.05 && Math.abs(l.lon - place.lon) < 0.05),
    [saved, place]
  );

  if (isLoading) return <OverviewSkeleton />;
  if (error || !data) {
    return <ErrorPanel message={(error as Error)?.message ?? t('weather.noDataHere')} onRetry={() => refetch()} />;
  }

  const c = data.forecast.current;
  const u = data.forecast.current_units;
  const today = days[0];

  return (
    <div className="space-y-6">
      <CurrentHero
        data={data}
        place={place}
        today={today}
        onRefresh={() => refetch()}
        refreshing={isFetching}
        saved={isSaved}
        savePending={add.isPending}
        onSave={() =>
          add.mutate({
            name: place.name, country: place.country ?? null, admin1: place.admin1 ?? null,
            lat: place.lat, lon: place.lon, timezone: place.timezone ?? null,
          } as any)
        }
      />

      <HourStrip hours={hours} units={units} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HourlyChart hours={hours} />
        </div>
        <WindCompass
          speed={Number(c.wind_speed_10m)}
          deg={Number(c.wind_direction_10m)}
          gusts={Number(c.wind_gusts_10m)}
          unit={u.wind_speed_10m}
          delay={0.05}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DailyForecast days={days} units={units} />
        <div className="space-y-6">
          {today && <SunArc day={today} utcOffset={data.forecast.utc_offset_seconds} delay={0.05} />}
          <UVPanel
            uv={hours[0]?.uv ?? 0}
            uvMax={today?.uvMax ?? 0}
            delay={0.1}
          />
        </div>
        <div className="space-y-6">
          <AirQuality air={data.air} delay={0.05} />
          <ComfortPanel
            temp={Number(c.temperature_2m)}
            humidity={Number(c.relative_humidity_2m)}
            wind={Number(c.wind_speed_10m)}
            delay={0.1}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MetricTiles data={data} hours={hours} />
        </div>
        <PressurePanel hours={hours} current={Number(c.pressure_msl)} delay={0.05} />
      </div>

      <HouseholdIndices data={data} days={days} hours={hours} />

      <ExtremesHunter />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass card-hover relative overflow-hidden rounded-3xl p-6"
      >
        <div className="aurora-blob" style={{ width: 320, height: 320, right: '-6%', top: '-90%', background: 'radial-gradient(circle, rgba(53,220,244,.4), transparent 70%)' }} />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-aqua-400/12 text-aqua-300">
              <MapIcon size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('dash.mapPromoTitle')}</h3>
              <p className="text-sm text-[var(--text-dim)]">
                {t('dash.mapPromoText')}
              </p>
            </div>
          </div>
          <Link
            to="/app/map"
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-aqua-400 to-violet-500 px-6 py-3 text-sm font-bold text-ink-950 shadow-glow transition hover:scale-[1.03]"
          >
            {t('dash.openMap')}
            <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </motion.div>

      <p className="pb-4 text-center text-xs text-[var(--text-dim)]">
        {t('dash.updatedAt')} {new Date(data.fetchedAt).toLocaleTimeString(localeTag())} · {t('dash.source')} Open-Meteo ·
        {t('dash.timezone')} {data.forecast.timezone}
      </p>
    </div>
  );
}
