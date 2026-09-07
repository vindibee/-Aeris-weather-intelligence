import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useFavourites } from '../../hooks/useFavourites';
import type { FavouriteCity } from '../../services/favourites';

/**
 * Звезда «в избранное».
 *
 * Единственный элемент управления избранным во всём приложении: он же
 * добавляет, он же снимает. Состояние берётся из общего списка, поэтому все
 * звёзды на экране закрашены согласованно, а клик по любой из них меняет их
 * все сразу.
 */

export default function FavouriteButton({
  city, size = 'md', showLabel = false, className = '',
}: {
  city: FavouriteCity;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}) {
  const { isFavourite, toggle, pending } = useFavourites();
  const active = isFavourite(city);

  const px = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  const pad = size === 'sm' ? 'p-1.5' : size === 'lg' ? 'p-3' : 'p-2.5';

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggle(city); }}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? `Убрать ${city.name} из избранного` : `Добавить ${city.name} в избранное`}
      title={active ? 'Убрать из избранного' : 'В избранное'}
      className={`group inline-flex items-center gap-2 rounded-xl border transition disabled:opacity-60 ${pad} ${
        active
          ? 'border-amber-400/45 bg-amber-400/12 text-amber-300'
          : 'border-white/12 text-[var(--text-dim)] hover:border-amber-400/35 hover:text-amber-300'
      } ${className}`}
    >
      <motion.span
        // лёгкий отклик на нажатие вместо мгновенной подмены иконки
        animate={{ scale: active ? [1, 1.28, 1] : 1 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="grid place-items-center"
      >
        <Star size={px} fill={active ? 'currentColor' : 'none'} strokeWidth={active ? 1.8 : 2} />
      </motion.span>
      {showLabel && (
        <span className="text-xs font-bold">
          {active ? 'В избранном' : 'В избранное'}
        </span>
      )}
    </button>
  );
}
