import { cached } from './cache.js';

export class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

/** GET JSON from a free weather provider with timeout, retry and TTL caching. */
export async function fetchJson(url, { ttl = 5 * 60_000, retries = 2, timeout = 12_000 } = {}) {
  return cached(url, ttl, async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { 'User-Agent': 'Aeris-Weather/1.0 (open-meteo client)' },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new UpstreamError(
            `Провайдер вернул ${res.status}: ${body.slice(0, 200)}`,
            res.status === 429 ? 429 : 502
          );
        }
        return await res.json();
      } catch (err) {
        lastError = err;
        if (err?.status === 429 || attempt === retries) break;
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof UpstreamError
      ? lastError
      : new UpstreamError(`Не удалось получить данные: ${lastError?.message ?? 'unknown'}`);
  });
}

export const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`)
    .join('&');
