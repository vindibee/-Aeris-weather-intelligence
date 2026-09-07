import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '../lib/store';
import {
  repositoryFor, findFavourite, takeGuestFavourites,
  type FavouriteCity, type FavouriteRecord,
} from '../services/favourites';

/**
 * Избранные локации: единственное место, где UI получает список и меняет его.
 *
 * Раньше добавление и удаление жили в разных страницах, звезда не знала о
 * состоянии списка и не могла быть снята повторным кликом. Теперь операция
 * одна — toggle, и она оптимистична: иконка закрашивается сразу, а не после
 * ответа сервера.
 */

const KEY = (authenticated: boolean) => ['favourites', authenticated ? 'server' : 'guest'];

export function useFavourites() {
  const user = useApp((s) => s.user);
  const authenticated = !!user;
  const repo = useMemo(() => repositoryFor(authenticated), [authenticated]);
  const qc = useQueryClient();
  const key = KEY(authenticated);

  const query = useQuery<FavouriteRecord[]>({
    queryKey: key,
    queryFn: () => repo.list(),
    staleTime: 30_000,
  });

  const list = query.data;

  const add = useMutation({
    mutationFn: (city: FavouriteCity) => repo.add(city),
    onMutate: async (city) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FavouriteRecord[]>(key) ?? [];
      // временная запись: звезда закрашивается мгновенно
      const optimistic: FavouriteRecord = {
        ...city,
        id: `pending:${city.lat}:${city.lon}`,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<FavouriteRecord[]>(key, [...previous, optimistic]);
      return { previous };
    },
    onError: (_e, _city, ctx) => {
      // откатываем, чтобы интерфейс не показывал несуществующее избранное
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: number | string) => repo.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FavouriteRecord[]>(key) ?? [];
      qc.setQueryData<FavouriteRecord[]>(key, previous.filter((f) => f.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const isFavourite = useCallback(
    (point: { lat: number; lon: number }) => !!findFavourite(list, point),
    [list]
  );

  /** Добавить, если города нет в списке, и убрать, если уже есть. */
  const toggle = useCallback(
    (city: FavouriteCity) => {
      const existing = findFavourite(list, city);
      if (existing) remove.mutate(existing.id);
      else add.mutate(city);
    },
    [list, add, remove]
  );

  return {
    list: list ?? [],
    isLoading: query.isLoading,
    error: query.error,
    isFavourite,
    toggle,
    add: add.mutate,
    remove: remove.mutate,
    pending: add.isPending || remove.isPending,
  };
}

/**
 * Переносит гостевое избранное в аккаунт после входа.
 *
 * Пользователь мог отмечать города до регистрации — терять этот список при
 * первом же входе неприятно и выглядит как баг.
 */
export function useMergeGuestFavourites() {
  const qc = useQueryClient();

  return useCallback(async () => {
    const guest = takeGuestFavourites();
    if (!guest.length) return 0;

    const repo = repositoryFor(true);
    const existing = await repo.list().catch(() => [] as FavouriteRecord[]);

    let merged = 0;
    for (const city of guest) {
      if (findFavourite(existing, city)) continue;
      try {
        await repo.add(city);
        merged++;
      } catch {
        // одна неудачная запись не должна прерывать перенос остальных
      }
    }
    if (merged) qc.invalidateQueries({ queryKey: KEY(true) });
    return merged;
  }, [qc]);
}
