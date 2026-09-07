import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import CityDashboard, { type CityRef } from './CityDashboard';

/**
 * Глобальная точка открытия сводки по городу.
 *
 * Любой компонент — метка на глобусе, клик по карте, строка поиска, карточка
 * избранного — вызывает `openCity()` и не знает ни про модальное окно, ни про
 * то, что внутри. Это убирает дублирование: раньше каждое место, где можно
 * кликнуть по городу, тянуло бы свою копию модалки.
 */

interface CityDashboardApi {
  openCity: (city: CityRef) => void;
  closeCity: () => void;
  current: CityRef | null;
}

const Ctx = createContext<CityDashboardApi | null>(null);

export function useCityDashboard(): CityDashboardApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useCityDashboard вызван вне CityDashboardProvider');
  }
  return ctx;
}

function Modal({ city, onClose }: { city: CityRef; onClose: () => void }) {
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

  return createPortal(
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
        className="glass-strong relative my-auto w-full max-w-5xl overflow-hidden rounded-[1.8rem] p-6 shadow-card sm:p-8"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-xl p-2 text-[var(--text-dim)] transition hover:bg-white/10 hover:text-[var(--text)]"
          aria-label="Закрыть"
        >
          <X size={17} />
        </button>
        <CityDashboard city={city} />
      </motion.div>
    </motion.div>,
    document.body
  );
}

export default function CityDashboardProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState<CityRef | null>(null);

  const openCity = useCallback((next: CityRef) => setCity(next), []);
  const closeCity = useCallback(() => setCity(null), []);

  const api = useMemo(
    () => ({ openCity, closeCity, current: city }),
    [openCity, closeCity, city]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <AnimatePresence>
        {city && <Modal key={`${city.lat}:${city.lon}`} city={city} onClose={closeCity} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
