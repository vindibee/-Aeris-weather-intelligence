import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { api, type GridCell, type GridResponse, type RadarFrame } from '../../lib/api';
import { tempColor, windColor } from '../../lib/weather';

export type OverlayKind = 'temp' | 'clouds' | 'precip' | 'humidity' | 'none';

interface Props {
  center: { lat: number; lon: number };
  overlay: OverlayKind;
  showWind: boolean;
  radarFrame: RadarFrame | null;
  radarOpacity: number;
  theme: 'dark' | 'light';
  onPointPick: (p: { lat: number; lon: number }) => void;
  onGridChange?: (g: GridResponse | null, loading: boolean) => void;
}

/**
 * OpenFreeMap serves OpenStreetMap vector tiles for free with no API key and no
 * rate limit, which is exactly what we need for an open-data weather app.
 */
const STYLE_URL: Record<'dark' | 'light', string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
};

/**
 * Выполняет действие, когда стиль карты действительно готов принимать слои.
 *
 * Раньше код просто выходил по `!map.isStyleLoaded()` и больше не возвращался:
 * если сетка приезжала быстрее, чем догружался стиль, слой данных не появлялся
 * вообще — карта оставалась «чёрной» до случайного перемещения мышью.
 */
function whenStyleReady(map: MLMap, fn: () => void) {
  if (map.isStyleLoaded()) { fn(); return; }
  const run = () => {
    if (!map.isStyleLoaded()) return;   // ждём следующего события
    map.off('idle', run);
    map.off('styledata', run);
    fn();
  };
  map.on('styledata', run);
  map.on('idle', run);
}

/** Prefer Russian place names, falling back to the latin/native ones. */
function localizeLabels(map: MLMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (field === undefined) continue;
    try {
      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', 'name:ru'],
        ['get', 'name:en'],
        ['get', 'name:latin'],
        ['get', 'name'],
      ]);
    } catch { /* some layers use non-name fields (house numbers, shields) */ }
  }
}

/* ---------- overlay bitmap ---------- */

function valueOf(cell: GridCell, kind: OverlayKind): number | null {
  switch (kind) {
    case 'temp': return cell.temp;
    case 'clouds': return cell.clouds;
    case 'precip': return cell.precip;
    case 'humidity': return cell.humidity;
    default: return null;
  }
}

function colorFor(v: number | null, kind: OverlayKind): [number, number, number, number] {
  if (v == null) return [0, 0, 0, 0];
  if (kind === 'temp') {
    const rgb = tempColor(v).match(/\d+/g)!.map(Number);
    return [rgb[0], rgb[1], rgb[2], 122];
  }
  if (kind === 'clouds') {
    const a = Math.min(150, (v / 100) * 150);
    return [226, 236, 250, a];
  }
  if (kind === 'humidity') {
    const k = Math.max(0, Math.min(1, (v - 20) / 80));
    return [Math.round(60 + (30 - 60) * k), Math.round(190 - 40 * k), Math.round(140 + 110 * k), 40 + k * 100];
  }
  // precipitation (mm/h)
  const k = Math.min(1, v / 6);
  if (v < 0.05) return [0, 0, 0, 0];
  return [Math.round(90 - 60 * k), Math.round(180 - 60 * k), 255, 60 + k * 150];
}

/** Render the sampled grid into a smooth bitmap we can hand to a maplibre image source. */
function gridToDataURL(grid: GridResponse, kind: OverlayKind): string | null {
  const { cols, rows, cells } = grid;
  if (!cells.length) return null;

  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sctx = small.getContext('2d');
  if (!sctx) return null;

  const img = sctx.createImageData(cols, rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // grid rows run south -> north, image rows run north -> south
      const cell = cells[(rows - 1 - r) * cols + c];
      const [rr, gg, bb, aa] = colorFor(cell ? valueOf(cell, kind) : null, kind);
      const o = (r * cols + c) * 4;
      img.data[o] = rr; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = aa;
    }
  }
  sctx.putImageData(img, 0, 0);

  const big = document.createElement('canvas');
  big.width = cols * 24;
  big.height = rows * 24;
  const bctx = big.getContext('2d');
  if (!bctx) return null;
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, big.width, big.height);
  bctx.filter = 'blur(8px)';
  bctx.drawImage(big, 0, 0);
  return big.toDataURL();
}

/* ---------- wind particle field ---------- */

interface Particle { x: number; y: number; age: number; life: number }

function sampleWind(grid: GridResponse, lat: number, lon: number): { u: number; v: number; speed: number } | null {
  const { bbox, cols, rows, cells } = grid;
  const fx = ((lon - bbox.west) / (bbox.east - bbox.west)) * cols - 0.5;
  const fy = ((lat - bbox.south) / (bbox.north - bbox.south)) * rows - 0.5;
  if (fx < -0.5 || fy < -0.5 || fx > cols - 0.5 || fy > rows - 0.5) return null;

  const x0 = Math.max(0, Math.min(cols - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));

  const at = (cx: number, cy: number) => {
    const cell = cells[cy * cols + cx];
    if (!cell || cell.wind == null || cell.dir == null) return { u: 0, v: 0 };
    const rad = (cell.dir * Math.PI) / 180;
    // meteorological direction = where the wind comes FROM
    return { u: -cell.wind * Math.sin(rad), v: -cell.wind * Math.cos(rad) };
  };

  const a = at(x0, y0), b = at(x1, y0), c = at(x0, y1), d = at(x1, y1);
  const u = (a.u * (1 - tx) + b.u * tx) * (1 - ty) + (c.u * (1 - tx) + d.u * tx) * ty;
  const v = (a.v * (1 - tx) + b.v * tx) * (1 - ty) + (c.v * (1 - tx) + d.v * tx) * ty;
  return { u, v, speed: Math.hypot(u, v) };
}

/* ------------------------------------------------------------------ */

export default function WeatherMap({
  center, overlay, showWind, radarFrame, radarOpacity, theme, onPointPick, onGridChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const gridRef = useRef<GridResponse | null>(null);
  const rafRef = useRef(0);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // loadGrid создаётся один раз и потому замыкал самую первую версию
  // drawOverlay — со старым значением overlay. Держим актуальную в ref.
  const drawOverlayRef = useRef<() => void>(() => {});

  /* --- init map --- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL[theme],
      center: [center.lon, center.lat],
      zoom: 4.2,
      attributionControl: { compact: true },
      maxZoom: 12,
      minZoom: 1.4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      map.resize();
      localizeLabels(map);
      setReady(true);
      // Вкладка появляется под анимацией перехода: на момент 'load' контейнер
      // ещё может доезжать до финального размера. Догоняем на следующих кадрах.
      requestAnimationFrame(() => map.resize());
      setTimeout(() => map.resize(), 260);
    });

    // The container is lazily mounted inside a Suspense boundary, so its final
    // height can land after the map measured itself. Keep them in sync.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    // Потеря WebGL-контекста (переключение GPU, нехватка памяти, длинный сон
    // вкладки) — единственный случай, когда canvas реально становится чёрным
    // и сам не восстанавливается. Ловим и пересобираем слои.
    const canvasEl = map.getCanvas();
    const onLost = (e: Event) => { e.preventDefault(); setContextLost(true); };
    const onRestored = () => {
      setContextLost(false);
      map.resize();
      whenStyleReady(map, () => {
        localizeLabels(map);
        drawOverlayRef.current();
      });
    };
    canvasEl.addEventListener('webglcontextlost', onLost as EventListener);
    canvasEl.addEventListener('webglcontextrestored', onRestored);

    const onVisible = () => { if (!document.hidden) map.resize(); };
    document.addEventListener('visibilitychange', onVisible);

    map.on('click', (e) => {
      onPointPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      markerRef.current?.remove();
      const el = document.createElement('div');
      el.style.cssText =
        'width:18px;height:18px;border-radius:50%;background:#7df2ff;box-shadow:0 0 0 4px rgba(125,242,255,.25),0 0 18px 4px rgba(125,242,255,.6);border:2px solid #04070f;cursor:pointer';
      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(e.lngLat)
        .addTo(map);
    });

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvasEl.removeEventListener('webglcontextlost', onLost as EventListener);
      canvasEl.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', onVisible);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- theme swap --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(STYLE_URL[theme]);
    map.once('styledata', () => {
      localizeLabels(map);
      gridRef.current = null;
      setReady(true);
      void loadGrid();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  /* --- follow the selected place --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.flyTo({ center: [center.lon, center.lat], zoom: Math.max(map.getZoom(), 5), duration: 1600, essential: true });
  }, [center.lat, center.lon, ready]);

  /* --- fetch grid for the current viewport --- */
  const loadGrid = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    setLoadingGrid(true);
    onGridChange?.(gridRef.current, true);
    try {
      const grid = await api.grid(
        { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
        { cols: 13, rows: 10 }
      );
      gridRef.current = grid;
      onGridChange?.(grid, false);
      drawOverlayRef.current();
    } catch {
      onGridChange?.(gridRef.current, false);
    } finally {
      setLoadingGrid(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    void loadGrid();
    let timer: number;
    const onIdle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadGrid(), 450);
    };
    map.on('moveend', onIdle);
    return () => {
      map.off('moveend', onIdle);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* --- paint the scalar overlay --- */
  const drawOverlay = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // Ждём готовности стиля, а не выходим молча: сетка часто приезжает раньше.
    whenStyleReady(map, () => {
      const grid = gridRef.current;
      if (map.getLayer('overlay-layer')) map.removeLayer('overlay-layer');
      if (map.getSource('overlay-src')) map.removeSource('overlay-src');
      if (overlay === 'none' || !grid) return;

      const url = gridToDataURL(grid, overlay);
      if (!url) return;
      const { north, south, east, west } = grid.bbox;

      map.addSource('overlay-src', {
        type: 'image',
        url,
        coordinates: [[west, north], [east, north], [east, south], [west, south]],
      });
      map.addLayer({
        id: 'overlay-layer',
        type: 'raster',
        source: 'overlay-src',
        paint: { 'raster-opacity': 0.58, 'raster-fade-duration': 400, 'raster-resampling': 'linear' },
      });
    });
  }, [overlay]);

  drawOverlayRef.current = drawOverlay;

  useEffect(() => {
    if (ready) drawOverlay();
  }, [overlay, ready, drawOverlay]);

  /* --- radar tiles --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Та же история, что и со слоем данных: ждём стиль, а не пропускаем кадр.
    whenStyleReady(map, () => {
      if (map.getLayer('radar-layer')) map.removeLayer('radar-layer');
      if (map.getSource('radar-src')) map.removeSource('radar-src');
      if (!radarFrame) return;

      map.addSource('radar-src', {
        type: 'raster',
        tiles: [`${radarFrame.url}/256/{z}/{x}/{y}/2/1_1.png`],
        tileSize: 256,
        attribution: 'RainViewer',
      });
      map.addLayer({
        id: 'radar-layer',
        type: 'raster',
        source: 'radar-src',
        paint: { 'raster-opacity': radarOpacity, 'raster-fade-duration': 250 },
      });
    });
  }, [radarFrame, ready, radarOpacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer('radar-layer')) {
      map.setPaintProperty('radar-layer', 'raster-opacity', radarOpacity);
    }
  }, [radarOpacity]);

  /* --- wind particles --- */
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas || !ready) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!showWind) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    let particles: Particle[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(2200, (w * h) / 900));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        age: Math.random() * 90, life: 55 + Math.random() * 70,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reset = (p: Particle) => {
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.age = 0;
      p.life = 55 + Math.random() * 70;
    };

    const tick = () => {
      const grid = gridRef.current;
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = 'rgba(0,0,0,0.90)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      if (grid) {
        // screen px per degree of longitude at the current zoom
        const p0 = map.project([grid.bbox.west, (grid.bbox.north + grid.bbox.south) / 2]);
        const p1 = map.project([grid.bbox.east, (grid.bbox.north + grid.bbox.south) / 2]);
        const pxPerDeg = Math.abs(p1.x - p0.x) / Math.max(0.001, grid.bbox.east - grid.bbox.west);
        const k = (pxPerDeg / 111) * 0.06; // km/h -> px per frame

        ctx.lineWidth = 1.25;
        ctx.lineCap = 'round';

        for (const p of particles) {
          const ll = map.unproject([p.x, p.y]);
          const wind = sampleWind(grid, ll.lat, ll.lng);
          if (!wind || wind.speed < 0.2) { reset(p); continue; }

          const nx = p.x + wind.u * k;
          const ny = p.y - wind.v * k;

          const alpha = Math.min(1, (1 - p.age / p.life) * 1.6) * 0.75;
          ctx.strokeStyle = windColor(wind.speed);
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(nx, ny);
          ctx.stroke();

          p.x = nx; p.y = ny; p.age += 1;
          if (p.age > p.life || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) reset(p);
        }
        ctx.globalAlpha = 1;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [showWind, ready]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl">
      {/* maplibre-gl.css is unlayered, so its `.maplibregl-map { position: relative }`
          would beat Tailwind utilities — inline styles keep the container filling us. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ mixBlendMode: theme === 'dark' ? 'screen' : 'multiply' }}
      />
      {contextLost && (
        <div className="absolute inset-0 z-20 grid place-items-center rounded-3xl bg-ink-950/85 backdrop-blur-sm">
          <div className="max-w-xs px-6 text-center">
            <div className="text-sm font-bold">Графический контекст потерян</div>
            <p className="mt-2 text-xs text-[var(--text-dim)]">
              Браузер освободил WebGL под другую вкладку. Карта восстановится сама, как
              только контекст вернётся.
            </p>
          </div>
        </div>
      )}
      {loadingGrid && (
        <div className="glass pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold">
          <span className="h-2 w-2 animate-ping rounded-full bg-aqua-400" />
          Загружаем метеосетку…
        </div>
      )}
    </div>
  );
}
