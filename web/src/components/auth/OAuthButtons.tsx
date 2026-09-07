import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, tokenStore, type User } from '../../lib/api';
import { useApp } from '../../lib/store';

/**
 * Вход через внешних провайдеров.
 *
 * Кнопка появляется только если провайдер реально настроен на сервере —
 * иначе пользователь жал бы на заведомо нерабочее. Список приходит с
 * /api/auth/providers.
 */

function GoogleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

function TelegramIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path
        fill="#fff"
        d="M5.5 11.8 17 7.3c.6-.2 1.1.1.9.9l-2 9.3c-.1.6-.5.8-1.1.5l-3-2.2-1.5 1.4c-.2.2-.3.3-.6.3l.2-3 5.5-5c.2-.2 0-.3-.4-.1l-6.8 4.3-2.9-.9c-.6-.2-.6-.6.2-1z"
      />
    </svg>
  );
}

interface Providers {
  google: boolean;
  telegram: boolean;
  telegramBot: string | null;
}

/**
 * Виджет Telegram монтируется скриптом с их домена и вызывает глобальный
 * колбэк. Это единственный поддерживаемый способ — обычной ссылкой подпись
 * не получить.
 */
function TelegramWidget({ bot, onAuth }: { bot: string; onAuth: (payload: unknown) => void }) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = holder.current;
    if (!node) return;

    const CALLBACK = '__aerisTelegramAuth';
    (window as unknown as Record<string, unknown>)[CALLBACK] = onAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', bot);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', `${CALLBACK}(user)`);
    node.appendChild(script);

    return () => {
      node.replaceChildren();
      delete (window as unknown as Record<string, unknown>)[CALLBACK];
    };
  }, [bot, onAuth]);

  return <div ref={holder} className="flex justify-center" />;
}

export default function OAuthButtons({ redirect = '/app' }: { redirect?: string }) {
  const { t } = useTranslation();
  const setUser = useApp((s) => s.setUser);

  const { data } = useQuery<Providers>({
    queryKey: ['auth-providers'],
    queryFn: () => api.authProviders(),
    staleTime: 10 * 60_000,
  });

  const onTelegram = async (payload: unknown) => {
    try {
      const { user, token } = await api.telegramLogin(payload as Record<string, unknown>);
      tokenStore.set(token);
      setUser(user as User);
      window.location.assign(redirect);
    } catch (e) {
      // виджет живёт вне React-дерева, показать ошибку внутри него нечем
      alert((e as Error).message ?? 'Не удалось войти через Telegram');
    }
  };

  if (!data?.google && !data?.telegram) return null;

  return (
    <div className="mt-4 space-y-2.5">
      {data.google && (
        <a
          href={`/api/auth/google?redirect=${encodeURIComponent(redirect)}`}
          className="glass flex w-full items-center justify-center gap-2.5 rounded-2xl py-3 text-sm font-semibold transition hover:border-white/25"
        >
          <GoogleIcon />
          {t('auth.withGoogle')}
        </a>
      )}

      {data.telegram && data.telegramBot ? (
        <TelegramWidget bot={data.telegramBot} onAuth={onTelegram} />
      ) : data.telegram ? (
        <div className="glass flex w-full items-center justify-center gap-2.5 rounded-2xl py-3 text-sm font-semibold opacity-60">
          <TelegramIcon />
          {t('auth.withTelegram')}
        </div>
      ) : null}
    </div>
  );
}
