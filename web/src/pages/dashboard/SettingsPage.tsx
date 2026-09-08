import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Ruler, Palette, Home, Check, Activity, Server, Clock, Loader2, User as UserIcon,
  Shirt,
} from 'lucide-react';
import { useApp } from '../../lib/store';
import { api } from '../../lib/api';

function Section({ title, icon: Icon, children, delay = 0 }: {
  title: string; icon: typeof Ruler; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass rounded-3xl p-6"
    >
      <div className="flex items-center gap-2.5 text-sm font-bold">
        <Icon size={16} className="text-aqua-300" />
        {title}
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}

/* Константа вне React: храним ключи, текст берём при отрисовке. */
const KIND_LABELS: Record<string, string> = {
  account_created: 'settings.actCreated',
  login: 'settings.actLogin',
  location_added: 'settings.actAdded',
  location_removed: 'settings.actRemoved',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const units = useApp((s) => s.units);
  const setUnits = useApp((s) => s.setUnits);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const place = useApp((s) => s.place);

  const [savingHome, setSavingHome] = useState(false);
  const [savedHome, setSavedHome] = useState(false);
  const [savingGender, setSavingGender] = useState(false);

  /**
   * Пол нужен только «Одеватору»: по нему выбирается 3D-модель в карточке
   * города. Значение null — законное состояние, тогда показываются обе фигуры.
   */
  const saveGender = async (gender: 'male' | 'female' | null) => {
    setSavingGender(true);
    try {
      const { user: updated } = await api.updateMe({ gender });
      setUser(updated);
    } finally {
      setSavingGender(false);
    }
  };

  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: async () => (await api.activity()).activity,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    refetchInterval: 30_000,
  });

  const saveHome = async () => {
    setSavingHome(true);
    try {
      const { user: updated } = await api.updateMe({
        home: { lat: place.lat, lon: place.lon, name: place.name },
      });
      setUser(updated);
      setSavedHome(true);
      setTimeout(() => setSavedHome(false), 2200);
    } finally {
      setSavingHome(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('nav.settings')}</h1>
        <p className="mt-1 text-sm text-[var(--text-dim)]">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t('settings.profile')} icon={UserIcon}>
          <div className="flex items-center gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-ink-950"
              style={{
                background: `linear-gradient(135deg, hsl(${user?.avatarHue ?? 200} 90% 65%), hsl(${(user?.avatarHue ?? 200) + 60} 85% 60%))`,
              }}
            >
              {(user?.name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold">{user?.name}</div>
              <div className="truncate text-sm text-[var(--text-dim)]">{user?.email}</div>
              <div className="mt-1 text-xs text-[var(--text-dim)]">
                {t('settings.memberSince')} {user?.createdAt?.slice(0, 10)}
              </div>
            </div>
          </div>
        </Section>

        <Section title={t('settings.units')} icon={Ruler} delay={0.05}>
          <div className="glass flex gap-1 rounded-2xl p-1.5">
            {([['metric', t('settings.metric'), t('settings.metricHint')], ['imperial', t('settings.imperial'), '°F · mph · in']] as const).map(
              ([key, label, hint]) => (
                <button
                  key={key}
                  onClick={() => setUnits(key)}
                  className={`relative flex-1 rounded-xl px-4 py-3 text-left transition ${
                    units === key ? 'text-ink-950' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {units === key && (
                    <motion.span layoutId="units-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-aqua-400 to-violet-400" />
                  )}
                  <span className="relative block text-sm font-bold">{label}</span>
                  <span className="relative block text-[11px] opacity-80">{hint}</span>
                </button>
              )
            )}
          </div>
        </Section>

        <Section title={t('settings.genderTitle')} icon={Shirt} delay={0.08}>
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-dim)]">
            {t('settings.genderHint')}
            Если не указан — выводятся обе.
          </p>
          <div className="glass flex gap-1 rounded-2xl p-1.5">
            {([
              ['male', t('settings.male')],
              ['female', t('settings.female')],
              [null, t('settings.unspecified')],
            ] as const).map(([key, label]) => {
              const on = (user?.gender ?? null) === key;
              return (
                <button
                  key={String(key)}
                  onClick={() => saveGender(key)}
                  disabled={savingGender}
                  className={`relative flex-1 rounded-xl px-4 py-3 text-center transition disabled:opacity-60 ${
                    on ? 'text-ink-950' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                  }`}
                >
                  {on && (
                    <motion.span layoutId="gender-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-aqua-400 to-violet-400" />
                  )}
                  <span className="relative block text-sm font-bold">{label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title={t('settings.appearance')} icon={Palette} delay={0.1}>
          <div className="glass flex gap-1 rounded-2xl p-1.5">
            {([['dark', t('settings.dark')], ['light', t('settings.light')]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={`relative flex-1 rounded-xl px-4 py-3 text-sm font-bold transition ${
                  theme === key ? 'text-ink-950' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                {theme === key && (
                  <motion.span layoutId="theme-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-aqua-400 to-violet-400" />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t('settings.homeTitle')} icon={Home} delay={0.15}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-[var(--text-dim)]">{t('settings.savedLabel')}</div>
              <div className="truncate font-semibold">{user?.home?.name ?? t('settings.notSet')}</div>
              <div className="mt-2 text-xs text-[var(--text-dim)]">{t('settings.currentLabel')}</div>
              <div className="truncate font-semibold text-aqua-300">{place.name}</div>
            </div>
            <button
              onClick={saveHome}
              disabled={savingHome}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-400 to-violet-500 px-5 py-3 text-sm font-bold text-ink-950 transition hover:scale-[1.03] disabled:opacity-60"
            >
              {savingHome ? <Loader2 size={15} className="animate-spin" /> : savedHome ? <Check size={15} /> : null}
              {savedHome ? t('settings.savedOk') : t('settings.makeHome')}
            </button>
          </div>
        </Section>

        <Section title={t('settings.serviceStatus')} icon={Server} delay={0.2}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/4 p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">API</div>
              <div className="mt-1 flex items-center gap-2 font-semibold">
                <span className={`h-2 w-2 rounded-full ${health ? 'bg-lime-400' : 'bg-rose-400'}`} />
                {health ? 'online' : 'offline'}
              </div>
            </div>
            <div className="rounded-2xl bg-white/4 p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">{t('settings.uptime')}</div>
              <div className="mt-1 font-mono font-semibold">
                {health ? `${Math.floor(health.uptimeSec / 60)} ${t('units.minute')}` : '—'}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-dim)]">
            {t('settings.sources')}
            CARTO + OpenStreetMap (базовая карта).
          </p>
        </Section>

        <Section title={t('settings.lastActivity')} icon={Activity} delay={0.25}>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {activity?.length ? (
              activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2.5 text-sm">
                  <Clock size={13} className="shrink-0 text-[var(--text-dim)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{KIND_LABELS[a.kind] ? t(KIND_LABELS[a.kind]) : a.kind}</div>
                    {a.detail && <div className="truncate text-xs text-[var(--text-dim)]">{a.detail}</div>}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-[var(--text-dim)]">
                    {a.created_at.slice(5, 16)}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-[var(--text-dim)]">{t('settings.noEvents')}</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
