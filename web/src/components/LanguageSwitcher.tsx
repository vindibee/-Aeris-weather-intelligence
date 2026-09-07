import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, currentLanguage, setLanguage, type LanguageCode } from '../i18n';

/**
 * Переключатель языка интерфейса.
 *
 * Выбор сохраняется в localStorage самим i18next, поэтому язык переживает
 * перезагрузку и не зависит от того, вошёл пользователь или нет.
 */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const active = currentLanguage();
  const activeMeta = LANGUAGES.find((l) => l.code === active) ?? LANGUAGES[1];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const choose = (code: LanguageCode) => {
    setLanguage(code);
    setOpen(false);
  };

  // подписка на смену языка, чтобы кнопка перерисовалась вместе с интерфейсом
  void i18n.resolvedLanguage;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Язык интерфейса"
        className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition hover:border-aqua-400/40"
      >
        <Globe size={16} className="shrink-0 text-aqua-300" />
        {compact ? (
          <span className="font-mono text-xs">{activeMeta.short}</span>
        ) : (
          <>
            <span aria-hidden>{activeMeta.flag}</span>
            <span className="hidden sm:inline">{activeMeta.short}</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass-strong absolute right-0 top-full z-[80] mt-2 w-52 overflow-hidden rounded-2xl p-1.5 shadow-card"
          >
            {LANGUAGES.map((l) => {
              const on = l.code === active;
              return (
                <li key={l.code}>
                  <button
                    role="option"
                    aria-selected={on}
                    onClick={() => choose(l.code)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      on ? 'bg-white/8 text-aqua-300' : 'hover:bg-white/6'
                    }`}
                  >
                    <span className="text-base" aria-hidden>{l.flag}</span>
                    <span className="flex-1 font-semibold">{l.label}</span>
                    <span className="font-mono text-[10px] text-[var(--text-dim)]">{l.short}</span>
                    {on && <Check size={14} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
