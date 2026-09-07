import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

export const locationsRouter = Router();
locationsRouter.use(requireAuth);

const shape = (r) => ({
  id: r.id, name: r.name, country: r.country, admin1: r.admin1,
  lat: r.lat, lon: r.lon, timezone: r.timezone,
  sortOrder: r.sort_order, createdAt: r.created_at,
});

const locationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  country: z.string().trim().max(120).nullish(),
  admin1: z.string().trim().max(120).nullish(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().max(64).nullish(),
});

locationsRouter.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM locations WHERE user_id = ? ORDER BY sort_order, id')
    .all(req.user.id);
  res.json({ locations: rows.map(shape) });
});

locationsRouter.post('/', (req, res) => {
  const parsed = locationSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const l = parsed.data;

  const count = db
    .prepare('SELECT COUNT(*) AS n FROM locations WHERE user_id = ?')
    .get(req.user.id).n;
  if (count >= 25) return res.status(409).json({ error: 'Достигнут лимит в 25 локаций' });

  // Treat points within ~1km as the same place to avoid near-duplicate cards.
  const dup = db
    .prepare(
      `SELECT id FROM locations
       WHERE user_id = ? AND ABS(lat - ?) < 0.01 AND ABS(lon - ?) < 0.01`
    )
    .get(req.user.id, l.lat, l.lon);
  if (dup) return res.status(409).json({ error: 'Эта локация уже сохранена' });

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO locations (user_id, name, country, admin1, lat, lon, timezone, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, l.name, l.country ?? null, l.admin1 ?? null, l.lat, l.lon,
         l.timezone ?? null, count);

  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)')
    .run(req.user.id, 'location_added', l.name);

  const row = db.prepare('SELECT * FROM locations WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ location: shape(row) });
});

locationsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Некорректный id' });

  const row = db.prepare('SELECT * FROM locations WHERE id = ? AND user_id = ?')
    .get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Локация не найдена' });

  db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  db.prepare('INSERT INTO activity (user_id, kind, detail) VALUES (?, ?, ?)')
    .run(req.user.id, 'location_removed', row.name);
  res.json({ ok: true, id });
});

locationsRouter.put('/order', (req, res) => {
  const parsed = z.object({ ids: z.array(z.number().int()).max(25) }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Некорректный порядок' });

  const stmt = db.prepare('UPDATE locations SET sort_order = ? WHERE id = ? AND user_id = ?');
  parsed.data.ids.forEach((id, i) => stmt.run(i, id, req.user.id));

  const rows = db.prepare('SELECT * FROM locations WHERE user_id = ? ORDER BY sort_order, id')
    .all(req.user.id);
  res.json({ locations: rows.map(shape) });
});
