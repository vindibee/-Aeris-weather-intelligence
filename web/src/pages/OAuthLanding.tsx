import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { api, tokenStore } from '../lib/api';
import { useApp } from '../lib/store';
import { Aurora } from '../components/Atmosphere';
import { LoadingPanel } from '../components/ui';

/**
 * Приёмники внешних входов.
 *
 * Сюда пользователь попадает редиректом: от Google — с токеном в хэше, от
 * бота — с одноразовым кодом в query. Обе страницы делают одно и то же:
 * кладут токен, подтягивают профиль и уводят в кабинет.
 */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-[100svh] place-items-center px-5">
      <Aurora intensity={0.9} />
      <div className="noise-overlay" />
      <div className="glass-strong relative z-10 w-full max-w-md rounded-[2rem] p-8 text-center">
        {children}
      </div>
    </div>
  );
}

function Failure({ message }: { message: string }) {
  const navigate = useNavigate();
  return (
    <Shell>
      <AlertCircle className="mx-auto text-rose-400" size={30} />
      <h1 className="mt-4 text-xl font-extrabold">Вход не удался</h1>
      <p className="mt-2 text-sm text-[var(--text-dim)]">{message}</p>
      <button
        onClick={() => navigate('/login', { replace: true })}
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-aqua-400 to-violet-500 py-3 font-bold text-ink-950"
      >
        Вернуться ко входу
      </button>
    </Shell>
  );
}

/** Google: токен приходит в хэше, чтобы не оседать в логах и истории. */
export function OAuthDone() {
  const navigate = useNavigate();
  const bootstrap = useApp((s) => s.bootstrap);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!token) {
      setError('Провайдер не передал токен доступа');
      return;
    }
    tokenStore.set(token);
    // хэш убираем сразу: токен не должен остаться в адресной строке
    window.history.replaceState(null, '', window.location.pathname);
    void bootstrap().then(() => navigate('/app', { replace: true }));
  }, [bootstrap, navigate]);

  if (error) return <Failure message={error} />;
  return <Shell><LoadingPanel label="Завершаем вход" /></Shell>;
}

/** Бот: одноразовый код из ссылки меняем на сессию. */
export function OAuthTelegram() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setUser = useApp((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      setError('В ссылке нет кода входа');
      return;
    }
    let alive = true;
    api.telegramCodeLogin(code)
      .then(({ user, token }) => {
        if (!alive) return;
        tokenStore.set(token);
        setUser(user);
        navigate('/app', { replace: true });
      })
      .catch((e: Error) => alive && setError(e.message ?? 'Код входа недействителен'));
    return () => { alive = false; };
  }, [params, setUser, navigate]);

  if (error) return <Failure message={error} />;
  return <Shell><LoadingPanel label="Входим через Telegram" /></Shell>;
}
