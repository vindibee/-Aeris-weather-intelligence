/** Tiny TTL cache + single-flight so bursts of identical requests hit upstream once. */
const store = new Map();
const inflight = new Map();

export function cacheStats() {
  return { entries: store.size, inflight: inflight.size };
}

export async function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await producer();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

// evict expired entries every minute so the map cannot grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires <= now) store.delete(k);
}, 60_000).unref();
