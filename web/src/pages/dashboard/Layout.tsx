import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Map as MapIcon, Star, Settings, LogOut, Search, Sun, Moon,
  Navigation, X, Menu, Loader2, MapPin, Building2, Rocket,
} from 'lucide-react';
import { useApp, fromGeo } from '../../lib/store';
import { useGeocode, useSavedLocations } from '../../hooks/useWeather';
import { api, type GeoResult } from '../../lib/api';
import { Aurora } from '../../components/Atmosphere';
import { useCityDashboard } from '../../components/city/CityDashboardProvider';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';

interface NavItem {
  to: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
  key: string;
}

const NAV: NavItem[] = [
  { to: '/app', end: true, icon: LayoutDashboard, key: 'nav.overview' },
  { to: '/app/map', icon: MapIcon, key: 'nav.map' },
  { to: '/app/locations', icon: Star, key: 'nav.locations' },
  { to: '/app/settings', icon: Settings, key: 'nav.settings' },
];

/** Раздел живёт вне кабинета, поэтому в навигации стоит отдельным блоком. */
const EXTERNAL_NAV = [
  { to: '/space-weather', icon: Rocket, label: 'Погода в космосе' },
];

/* ---------------- search ---------------- */

function SearchBox({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const setPlace = useApp((s) => s.setPlace);
  const { openCity } = useCityDashboard();
  const { data: results, isFetching } = useGeocode(term);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  /*
   * Выбор города в поиске делает две вещи: ставит его текущей точкой кабинета
   * и сразу показывает полную сводку. Раньше приходилось идти через несколько
   * экранов, чтобы увидеть индексы и подбор одежды.
   */
  const pick = (g: GeoResult) => {
    const place = fromGeo(g);
    setPlace(place);
    setTerm('');
    setOpen(false);
    onDone?.();
    openCity(place);
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const r = await api.reverse(coords.latitude, coords.longitude);
          setPlace({ name: r.name, country: r.country, admin1: r.admin1, lat: coords.latitude, lon: coords.longitude });
        } catch {
          setPlace({ name: 'Моя позиция', lat: coords.latitude, lon: coords.longitude });
        } finally {
          setLocating(false);
          setOpen(false);
          onDone?.();
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-lg">
      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5 transition focus-within:border-aqua-400/50">
        <Search size={17} className="shrink-0 text-[var(--text-dim)]" />
        <input
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={t('common.search')}
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-dim)]"
        />
        {isFetching && <Loader2 size={15} className="animate-spin text-aqua-400" />}
        {term && (
          <button onClick={() => setTerm('')} className="text-[var(--text-dim)] hover:text-[var(--text)]">
            <X size={15} />
          </button>
        )}
        <button
          onClick={locate}
          title="Моя геолокация"
          className="shrink-0 rounded-lg p-1.5 text-aqua-300 transition hover:bg-aqua-400/10"
        >
          {locating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
        </button>
      </div>

      <AnimatePresence>
        {open && term.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.18 }}
            className="glass-strong absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl p-2 shadow-card"
          >
            {isFetching && !results?.length ? (
              <div className="space-y-2 p-2">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-11 w-full" />)}
              </div>
            ) : results?.length ? (
              results.map((g) => (
                <button
                  key={`${g.id}-${g.lat}`}
                  onClick={() => pick(g)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/7"
                >
                  <MapPin size={15} className="shrink-0 text-aqua-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{g.name}</div>
                    <div className="truncate text-xs text-[var(--text-dim)]">
                      {[g.admin1, g.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  {!!g.population && (
                    <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-[var(--text-dim)]">
                      <Building2 size={10} />
                      {g.population > 1e6 ? `${(g.population / 1e6).toFixed(1)}M` : `${Math.round(g.population / 1e3)}k`}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-6 text-center text-sm text-[var(--text-dim)]">
                Ничего не найдено — попробуйте другое написание
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- sidebar ---------------- */

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { data: saved } = useSavedLocations();
  const place = useApp((s) => s.place);
  const setPlace = useApp((s) => s.setPlace);

  return (
    <div className="flex h-full flex-col gap-2">
      <nav className="space-y-1.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-aqua-400/18 to-violet-500/10 text-[var(--text)]'
                  : 'text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-aqua-400 to-violet-500"
                  />
                )}
                <n.icon size={18} className={isActive ? 'text-aqua-300' : ''} />
                {t(n.key)}
              </>
            )}
          </NavLink>
        ))}

        {EXTERNAL_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-violet-500/20 to-magenta-400/10 text-[var(--text)]'
                  : 'text-[var(--text-dim)] hover:bg-white/5 hover:text-[var(--text)]'
              }`
            }
          >
            <n.icon size={18} className="text-violet-300" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      {!!saved?.length && (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-dim)]">
            Мои локации
          </div>
          <div className="space-y-0.5">
            {saved.map((l) => {
              const active = Math.abs(l.lat - place.lat) < 0.05 && Math.abs(l.lon - place.lon) < 0.05;
              return (
                <button
                  key={l.id}
                  onClick={() => { setPlace(l); onNavigate?.(); }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-2 text-left text-sm transition ${
                    active ? 'bg-white/8 text-aqua-300' : 'text-[var(--text-dim)] hover:bg-white/5'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-aqua-400' : 'bg-white/20'}`} />
                  <span className="truncate">{l.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- layout ---------------- */

export default function DashboardLayout() {
  const user = useApp((s) => s.user);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const logout = useApp((s) => s.logout);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.name ?? '?')
    .split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const doLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="relative min-h-[100svh]">
      <Aurora intensity={0.5} />
      <div className="noise-overlay" />

      {/* top bar */}
      <header className="glass-strong sticky top-0 z-40 border-b border-white/8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="glass rounded-xl p-2 lg:hidden"
            aria-label="Меню"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <NavLink to="/app" className="flex shrink-0 items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-aqua-400 to-violet-500 shadow-glow">
              <Sun className="text-ink-950" size={17} strokeWidth={2.6} />
            </div>
            <span className="hidden text-lg font-extrabold tracking-tight sm:block">Aeris</span>
          </NavLink>

          <div className="flex flex-1 justify-center px-2">
            <SearchBox onDone={() => setMobileOpen(false)} />
          </div>

          <LanguageSwitcher />

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="glass rounded-xl p-2.5 transition hover:border-aqua-400/40"
            title="Сменить тему"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="block"
              >
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
              </motion.span>
            </AnimatePresence>
          </button>

          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-ink-950"
              style={{
                background: `linear-gradient(135deg, hsl(${user?.avatarHue ?? 200} 90% 65%), hsl(${(user?.avatarHue ?? 200) + 60} 85% 60%))`,
              }}
            >
              {initials}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="max-w-[130px] truncate text-sm font-bold">{user?.name}</div>
              <div className="max-w-[130px] truncate text-[11px] text-[var(--text-dim)]">{user?.email}</div>
            </div>
            <button
              onClick={doLogout}
              className="glass rounded-xl p-2.5 text-[var(--text-dim)] transition hover:border-rose-400/40 hover:text-rose-300"
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
        <aside className="sticky top-24 hidden h-[calc(100svh-8rem)] w-60 shrink-0 lg:block">
          <SideNav />
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="glass-strong fixed left-0 top-0 z-50 h-full w-72 overflow-y-auto p-5 pt-20 lg:hidden"
              >
                <SideNav onNavigate={() => setMobileOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 pb-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
