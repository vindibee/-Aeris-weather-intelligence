import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from './lib/store';
import { LoadingPanel } from './components/ui';
import Landing from './pages/Landing';
import { LoginPage, RegisterPage } from './pages/Auth';

const DashboardLayout = lazy(() => import('./pages/dashboard/Layout'));
const Overview = lazy(() => import('./pages/dashboard/Overview'));
const MapPage = lazy(() => import('./pages/dashboard/MapPage'));
const LocationsPage = lazy(() => import('./pages/dashboard/LocationsPage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const SpaceWeather = lazy(() => import('./pages/SpaceWeather'));

function Protected({ children }: { children: React.ReactNode }) {
  const user = useApp((s) => s.user);
  const authReady = useApp((s) => s.authReady);
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="grid min-h-[100svh] place-items-center">
        <LoadingPanel label="Проверяем сессию" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const bootstrap = useApp((s) => s.bootstrap);
  const location = useLocation();

  useEffect(() => { bootstrap(); }, [bootstrap]);
  // Переход по якорю (например /#globe со страницы космоса) не должен
  // затираться безусловной прокруткой наверх.
  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname, location.hash]);

  return (
    <Suspense fallback={<div className="grid min-h-[100svh] place-items-center"><LoadingPanel /></div>}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname.split('/')[1] || 'root'}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/space-weather" element={<SpaceWeather />} />

          <Route path="/app" element={<Protected><DashboardLayout /></Protected>}>
            <Route index element={<Page><Overview /></Page>} />
            <Route path="map" element={<Page><MapPage /></Page>} />
            <Route path="locations" element={<Page><LocationsPage /></Page>} />
            <Route path="settings" element={<Page><SettingsPage /></Page>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
