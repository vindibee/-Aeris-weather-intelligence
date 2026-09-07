import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/* ---------------- loading states ---------------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

/** Full-panel loading state with an animated radar sweep. */
export function LoadingPanel({ label = 'Загружаем данные' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-5 py-10">
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border border-aqua-400/20" />
        <div className="absolute inset-2 rounded-full border border-aqua-400/15" />
        <div className="absolute inset-4 rounded-full border border-aqua-400/10" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(53,220,244,.45) 60deg, transparent 90deg)',
            animation: 'spin 1.4s linear infinite',
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-aqua-300 shadow-[0_0_18px_4px_rgba(53,220,244,.55)]" />
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
        <span>{label}</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-aqua-400"
              style={{ animation: `pulse-ring 1.4s ${i * 0.2}s ease-in-out infinite` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-3xl border border-rose-400/25 bg-rose-500/5 p-8 text-center">
      <AlertTriangle className="text-rose-400" size={30} />
      <div>
        <p className="font-semibold text-rose-200">Не удалось загрузить</p>
        <p className="mt-1 max-w-md text-sm text-[var(--text-dim)]">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-full border border-rose-400/40 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15"
        >
          Повторить
        </button>
      )}
    </div>
  );
}

/* ---------------- layout primitives ---------------- */

export function GlassCard({
  children, className = '', delay = 0, hover = true,
}: { children: ReactNode; className?: string; delay?: number; hover?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`glass rounded-3xl ${hover ? 'card-hover' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({
  eyebrow, title, subtitle, center = false,
}: { eyebrow?: string; title: ReactNode; subtitle?: string; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block rounded-full border border-aqua-400/25 bg-aqua-400/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-aqua-300"
        >
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 text-balance text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="mt-5 text-pretty text-base leading-relaxed text-[var(--text-dim)] sm:text-lg"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

/* ---------------- animated numbers ---------------- */

export function Stat({ value, suffix = '', label }: { value: string; suffix?: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-3xl font-bold text-gradient sm:text-4xl">
        {value}
        <span className="text-xl">{suffix}</span>
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-dim)]">{label}</div>
    </div>
  );
}

/** Thin animated progress meter used by UV / AQI / humidity readouts. */
export function Meter({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/8" style={{ height }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}66, ${color})`, boxShadow: `0 0 14px -2px ${color}` }}
      />
    </div>
  );
}
