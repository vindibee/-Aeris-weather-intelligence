import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError, api, tokenStore, type User, type GeoResult } from './api';

interface Place {
  name: string;
  country?: string | null;
  admin1?: string | null;
  lat: number;
  lon: number;
  timezone?: string | null;
}

interface AppState {
  user: User | null;
  authReady: boolean;
  place: Place;
  units: 'metric' | 'imperial';
  theme: 'dark' | 'light';

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setPlace: (p: Place) => void;
  setUnits: (u: 'metric' | 'imperial') => void;
  setTheme: (t: 'dark' | 'light') => void;
  setUser: (u: User) => void;
}

const DEFAULT_PLACE: Place = {
  name: 'Киев', country: 'Украина', admin1: 'Киев',
  lat: 50.4547, lon: 30.5238, timezone: 'Europe/Kyiv',
};

export const fromGeo = (g: GeoResult): Place => ({
  name: g.name, country: g.country, admin1: g.admin1,
  lat: g.lat, lon: g.lon, timezone: g.timezone,
});

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      authReady: false,
      place: DEFAULT_PLACE,
      units: 'metric',
      theme: 'dark',

      bootstrap: async () => {
        applyTheme(get().theme);
        try {
          const { user } = await api.me();
          // сервер — источник истины; сохранённый снимок только что заменён
          set({
            user,
            authReady: true,
            units: user.units,
            theme: user.theme,
            place: user.home
              ? { name: user.home.name, lat: user.home.lat, lon: user.home.lon }
              : get().place,
          });
          applyTheme(user.theme);
        } catch (err) {
          /*
           * Разделяем «сессии нет» и «сервер не ответил».
           *
           * Раньше любая ошибка — включая обрыв сети или перезапуск API —
           * вычищала токен, и пользователь оказывался разлогинен на ровном
           * месте. Сбрасываем сессию только на явный 401.
           */
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 401 || status === 403) {
            tokenStore.clear();
            set({ user: null, authReady: true });
          } else {
            // оставляем снимок из localStorage: интерфейс не «моргает» выходом
            set({ authReady: true });
          }
        }
      },

      login: async (email, password) => {
        const { user, token } = await api.login({ email, password });
        tokenStore.set(token);
        set({
          user, units: user.units, theme: user.theme,
          place: user.home
            ? { name: user.home.name, lat: user.home.lat, lon: user.home.lon }
            : get().place,
        });
        applyTheme(user.theme);
        return user;
      },

      register: async (name, email, password) => {
        const { user, token } = await api.register({ name, email, password });
        tokenStore.set(token);
        set({ user, units: user.units, theme: user.theme });
        applyTheme(user.theme);
        return user;
      },

      logout: async () => {
        await api.logout().catch(() => {});
        tokenStore.clear();
        set({ user: null });
      },

      setPlace: (place) => set({ place }),

      setUnits: (units) => {
        set({ units });
        if (get().user) api.updateMe({ units }).catch(() => {});
      },

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
        if (get().user) api.updateMe({ theme }).catch(() => {});
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'aeris-app',
      /*
       * Снимок пользователя тоже кладём в хранилище.
       *
       * Токен живёт в httpOnly-cookie и localStorage, но профиль подтягивался
       * только сетевым запросом: до его ответа шапка успевала отрисоваться как
       * для гостя. При переходе между разделами это читалось как слетевшая
       * сессия. Снимок нужен ровно для первого кадра — bootstrap() его сразу
       * заменяет ответом сервера или чистит на 401.
       */
      partialize: (s) => ({ place: s.place, units: s.units, theme: s.theme, user: s.user }),
    }
  )
);
