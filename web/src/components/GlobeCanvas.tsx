import {
  createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Canvas } from '@react-three/fiber';

/**
 * Переиспользуемая обёртка WebGL-сцены.
 *
 * Здесь собрано всё, что раньше дублировалось бы в каждом глобусе: настройки
 * контекста, курсор захвата, подсказка «потяните», защита от раздувания буфера
 * трансформами предка и внятное сообщение, если WebGL в браузере недоступен.
 */

export interface GlobeCanvasProps {
  children: ReactNode;
  className?: string;
  /** Позиция и угол камеры по умолчанию. */
  camera?: { position: [number, number, number]; fov: number };
  /** Кадры по требованию — для статичных сцен, которые двигаются только мышью. */
  onDemand?: boolean;
  dprMax?: number;
  /** Показывать подсказку про перетаскивание, пока пользователь не тронул сцену. */
  hint?: string | false;
  /** Сообщается наружу, когда сцену начинают или заканчивают тянуть. */
  onDragChange?: (dragging: boolean) => void;
}

/** Есть ли в браузере рабочий WebGL. Считаем один раз на модуль. */
let webglSupported: boolean | null = null;
function detectWebgl(): boolean {
  if (webglSupported !== null) return webglSupported;
  try {
    const canvas = document.createElement('canvas');
    webglSupported = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    webglSupported = false;
  }
  return webglSupported;
}

/** Сообщает обёртке о захвате сцены — контроллер вращения дергает это сам. */
const GlobeCanvasContext = createContext<(dragging: boolean) => void>(() => {});

export const useDragReporter = () => useContext(GlobeCanvasContext);

const DEFAULT_CAMERA: { position: [number, number, number]; fov: number } = {
  position: [0, 0.4, 8],
  fov: 38,
};

export default function GlobeCanvas({
  children,
  className = '',
  camera,
  onDemand = false,
  dprMax = 1.75,
  hint,
  onDragChange,
}: GlobeCanvasProps) {
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const supported = useRef(detectWebgl()).current;

  /*
   * Стабильная ссылка на параметры камеры.
   *
   * R3F переприменяет пропсы при смене их идентичности. Литерал объекта
   * рождается заново на каждом рендере, и любая перерисовка (например, смена
   * курсора при захвате) сбрасывала бы камеру в исходную точку, стирая поворот,
   * который пользователь только что сделал мышью.
   */
  const cameraProps = useMemo(
    () => camera ?? DEFAULT_CAMERA,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera?.position[0], camera?.position[1], camera?.position[2], camera?.fov]
  );

  const handleDrag = useCallback((v: boolean) => {
    setDragging(v);
    if (v) setTouched(true);
    onDragChange?.(v);
  }, [onDragChange]);

  if (!supported) {
    return (
      <div className={`grid place-items-center ${className}`}>
        <div className="max-w-xs rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-center">
          <div className="text-sm font-bold text-amber-200">3D недоступно</div>
          <p className="mt-1.5 text-xs leading-snug text-[var(--text-dim)]">
            Браузер не смог создать WebGL-контекст. Включите аппаратное ускорение
            в настройках или обновите драйверы видеокарты — остальные разделы
            работают без него.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Canvas
        camera={cameraProps}
        frameloop={onDemand ? 'demand' : 'always'}
        dpr={[1, dprMax]}
        // Замер контейнера без реакции на скролл: иначе трансформы предка
        // (scale/translate от скролл-анимаций) уходят в размер буфера и он
        // растёт от кадра к кадру.
        resize={{ scroll: false, debounce: 80 }}
        raycaster={{
          params: {
            Mesh: {},
            Sprite: {},
            LOD: {},
            // тонкие линии не должны перехватывать клики по меткам
            Line: { threshold: 0 },
            Points: { threshold: 0.14 },
          },
        }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      >
        <GlobeCanvasContext.Provider value={handleDrag}>{children}</GlobeCanvasContext.Provider>
      </Canvas>

      {hint && !touched && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="glass rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-[var(--text-dim)]">
            {hint}
          </span>
        </div>
      )}
    </div>
  );
}
