import { useEffect, useRef } from 'react';
import type { Sky } from '../lib/weather';

/** Slow-moving colour blobs that sit behind everything. Pure CSS, cheap. */
export function Aurora({ intensity = 1 }: { intensity?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="aurora-blob"
        style={{
          width: '58vw', height: '58vw', left: '-14vw', top: '-18vw',
          background: 'radial-gradient(circle, rgba(53,220,244,.55), transparent 68%)',
          opacity: 0.42 * intensity, animationDelay: '0s',
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: '52vw', height: '52vw', right: '-12vw', top: '4vh',
          background: 'radial-gradient(circle, rgba(139,92,246,.55), transparent 68%)',
          opacity: 0.4 * intensity, animationDelay: '-7s',
        }}
      />
      <div
        className="aurora-blob"
        style={{
          width: '46vw', height: '46vw', left: '22vw', bottom: '-20vh',
          background: 'radial-gradient(circle, rgba(244,114,182,.4), transparent 68%)',
          opacity: 0.32 * intensity, animationDelay: '-14s',
        }}
      />
      <div className="absolute inset-0 grid-lines opacity-60" />
    </div>
  );
}

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number;
  len: number; alpha: number; r: number;
}

/**
 * Canvas precipitation / cloud drift keyed to the current sky condition.
 * Rendered behind the hero card so the UI literally reacts to the weather.
 */
export function WeatherFX({ sky, className = '' }: { sky: Sky; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const density: Record<Sky, number> = {
      clear: 26, partly: 34, cloudy: 40, fog: 46,
      drizzle: 90, rain: 170, snow: 120, thunder: 190,
    };
    const n = reduce ? 12 : density[sky] ?? 40;

    const make = (): Particle => {
      const z = 0.35 + Math.random() * 0.9;
      switch (sky) {
        case 'rain':
        case 'thunder':
        case 'drizzle':
          return {
            x: Math.random() * w * 1.3 - w * 0.15, y: Math.random() * h, z,
            vx: (sky === 'drizzle' ? 0.4 : 1.1) * z,
            vy: (sky === 'drizzle' ? 3.2 : 8.5) * z,
            len: (sky === 'drizzle' ? 6 : 16) * z, alpha: 0.12 + z * 0.35, r: 1,
          };
        case 'snow':
          return {
            x: Math.random() * w, y: Math.random() * h, z,
            vx: Math.sin(Math.random() * 6) * 0.6, vy: 0.6 + z * 1.1,
            len: 0, alpha: 0.25 + z * 0.5, r: 1 + z * 2.2,
          };
        default:
          return {
            x: Math.random() * w, y: Math.random() * h, z,
            vx: 0.15 + z * 0.35, vy: (Math.random() - 0.5) * 0.08,
            len: 0, alpha: 0.05 + z * 0.16, r: 30 + z * 90,
          };
      }
    };

    let parts = Array.from({ length: n }, make);
    let flash = 0;
    let t = 0;

    const tick = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);

      if (sky === 'thunder' && !reduce) {
        if (Math.random() < 0.004) flash = 1;
        if (flash > 0) {
          ctx.fillStyle = `rgba(190,210,255,${flash * 0.22})`;
          ctx.fillRect(0, 0, w, h);
          flash -= 0.035;
        }
      }

      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (sky === 'snow') p.x += Math.sin(t * 1.2 + p.z * 8) * 0.5;

        if (p.y > h + 20 || p.x > w + 120 || p.x < -140) {
          Object.assign(p, make(), { y: sky === 'clear' || sky === 'partly' || sky === 'cloudy' || sky === 'fog' ? p.y : -20 });
          if (sky === 'cloudy' || sky === 'fog' || sky === 'clear' || sky === 'partly') p.x = -120;
        }

        if (p.len > 0) {
          ctx.strokeStyle = `rgba(150,205,255,${p.alpha})`;
          ctx.lineWidth = Math.max(0.6, p.z);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2, p.y - p.len);
          ctx.stroke();
        } else if (sky === 'snow') {
          ctx.fillStyle = `rgba(226,240,255,${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          const tint = sky === 'fog' ? '190,205,230' : sky === 'clear' ? '125,242,255' : '150,175,215';
          g.addColorStop(0, `rgba(${tint},${p.alpha})`);
          g.addColorStop(1, `rgba(${tint},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
    };
  }, [sky]);

  return <canvas ref={canvasRef} className={`pointer-events-none ${className}`} aria-hidden />;
}
