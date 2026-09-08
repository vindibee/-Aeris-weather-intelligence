import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff, Zap, AlertCircle, Check,
} from 'lucide-react';
import { useApp } from '../lib/store';
import OAuthButtons from '../components/auth/OAuthButtons';
import { Aurora } from '../components/Atmosphere';
import { Spinner } from '../components/ui';

const DEMO = { email: 'demo@aeris.app', password: 'demo1234' };

function Field({
  icon: Icon, type, value, onChange, placeholder, autoComplete, right,
}: {
  icon: typeof Mail; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  autoComplete?: string; right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
        focused
          ? 'border-aqua-400/60 bg-aqua-400/5 shadow-[0_0_0_4px_rgba(53,220,244,.08)]'
          : 'border-white/10 bg-white/4'
      }`}
    >
      <Icon size={18} className={focused ? 'text-aqua-300' : 'text-[var(--text-dim)]'} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--text-dim)]"
      />
      {right}
    </div>
  );
}

function AuthShell({ children, title, subtitle }: {
  children: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <div className="relative flex min-h-[100svh] items-center justify-center px-5 py-16">
      <Aurora intensity={1.1} />
      <div className="noise-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong relative z-10 w-full max-w-md rounded-[2rem] p-8 shadow-card sm:p-10"
      >
        <Link to="/" className="mx-auto flex w-fit items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-aqua-400 to-violet-500 shadow-glow">
            <Sun className="text-ink-950" size={21} strokeWidth={2.6} />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Aeris</span>
        </Link>

        <h1 className="mt-8 text-center text-2xl font-extrabold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-center text-sm text-[var(--text-dim)]">{subtitle}</p>

        {children}
      </motion.div>
    </div>
  );
}

function ErrorBanner({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useApp((s) => s.login);
  const user = useApp((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  const submit = async (e: FormEvent, creds?: { email: string; password: string }) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(creds?.email ?? email, creds?.password ?? password);
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t('auth.welcomeBack')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field icon={Mail} type="email" value={email} onChange={setEmail}
               placeholder="you@example.com" autoComplete="email" />
        <Field
          icon={Lock} type={show ? 'text' : 'password'} value={password} onChange={setPassword}
          placeholder={t('auth.password')} autoComplete="current-password"
          right={
            <button type="button" onClick={() => setShow((s) => !s)}
                    className="text-[var(--text-dim)] transition hover:text-aqua-300">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />

        <ErrorBanner error={error} />

        <button
          type="submit"
          disabled={loading}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-400 to-violet-500 py-3.5 font-bold text-ink-950 shadow-glow transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Spinner size={19} /> : <>{t('auth.signIn')} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4 text-xs text-[var(--text-dim)]">
        <div className="h-px flex-1 bg-white/10" /> или <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* внешние провайдеры показываются, только если настроены на сервере */}
      <div className="mb-4"><OAuthButtons /></div>

      <button
        onClick={(e) => submit(e, DEMO)}
        disabled={loading}
        className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold transition hover:border-amber-400/40 hover:bg-amber-400/5 disabled:opacity-60"
      >
        <Zap size={17} className="text-amber-400" />
        {t('auth.demoLogin')}
      </button>

      <p className="mt-3 text-center font-mono text-[11px] text-[var(--text-dim)]">
        demo@aeris.app · demo1234
      </p>

      <p className="mt-7 text-center text-sm text-[var(--text-dim)]">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-aqua-300 transition hover:text-aqua-200">
          {t('auth.register')}
        </Link>
      </p>
    </AuthShell>
  );
}

/* ------------------------------------------------------------------ */

/* Константа вне React: храним ключи, текст берём при отрисовке. */
const rules = [
  { test: (p: string) => p.length >= 8, labelKey: 'auth.min8' },
  { test: (p: string) => /[a-zA-Zа-яА-Я]/.test(p), labelKey: 'auth.hasLetter' },
  { test: (p: string) => /\d/.test(p), labelKey: 'auth.hasDigit' },
];

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useApp((s) => s.register);
  const user = useApp((s) => s.user);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  const strength = rules.filter((r) => r.test(password)).length;
  const strengthColor = ['#f43f5e', '#fb923c', '#fbbf24', '#4ade80'][strength];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/app', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t('auth.signUp')} subtitle={t('auth.signUpSubtitle')}>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field icon={UserIcon} type="text" value={name} onChange={setName}
               placeholder={t('auth.yourName')} autoComplete="name" />
        <Field icon={Mail} type="email" value={email} onChange={setEmail}
               placeholder="you@example.com" autoComplete="email" />
        <Field
          icon={Lock} type={show ? 'text' : 'password'} value={password} onChange={setPassword}
          placeholder={t('auth.createPassword')} autoComplete="new-password"
          right={
            <button type="button" onClick={() => setShow((s) => !s)}
                    className="text-[var(--text-dim)] transition hover:text-aqua-300">
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />

        <AnimatePresence>
          {password.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-1.5 pt-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      animate={{ width: strength > i ? '100%' : '0%' }}
                      transition={{ duration: 0.35 }}
                      className="h-full rounded-full"
                      style={{ background: strengthColor }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2.5 space-y-1">
                {rules.map((r) => {
                  const ok = r.test(password);
                  return (
                    <div key={r.labelKey}
                         className={`flex items-center gap-2 text-xs transition ${ok ? 'text-lime-400' : 'text-[var(--text-dim)]'}`}>
                      <Check size={12} className={ok ? 'opacity-100' : 'opacity-30'} />
                      {t(r.labelKey)}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <ErrorBanner error={error} />

        <button
          type="submit"
          disabled={loading || strength < 2}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua-400 to-violet-500 py-3.5 font-bold text-ink-950 shadow-glow transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? <Spinner size={19} /> : <>Создать аккаунт <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--text-dim)]">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-aqua-300 transition hover:text-aqua-200">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
