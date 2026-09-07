import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Stars, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { WORLD_CITIES, type WorldCity } from '../lib/cities';
import GlobeCanvas, { useDragReporter } from './GlobeCanvas';

export interface GlobeMarker {
  lat: number;
  lon: number;
  label: string;
  value?: string;
  color?: string;
}

const RADIUS = 2;

/**
 * Кадр может быть сколь угодно длинным (вкладка в фоне, тяжёлый ре-лейаут).
 * Всё, что интегрируется по времени, зажимаем — иначе после возврата на вкладку
 * анимация делает скачок вместо плавного продолжения.
 */
const MAX_DT = 1 / 30;
const step = (delta: number) => Math.min(delta, MAX_DT);

/** lat/lon (град) -> точка на сфере заданного радиуса */
function toVec3(lat: number, lon: number, r = RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/* ------------------------------------------------------------------ */
/*  Планета: градиентное тело + френелевая атмосфера                   */
/* ------------------------------------------------------------------ */

const bodyVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bodyFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uRim;
  varying vec3 vNormal;
  varying vec3 vPos;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fres = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
    float band = smoothstep(-1.0, 1.0, vPos.y * 0.55 + sin(vPos.x * 1.5 + uTime * 0.18) * 0.12);
    vec3 base = mix(uDeep, uMid, band);
    vec3 color = mix(base, uRim, fres * 0.7);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmoFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float rim = 1.0 - abs(dot(vNormal, viewDir));
    float intensity = pow(rim, 3.2) * 0.85;
    float pulse = 0.86 + 0.14 * sin(uTime * 1.1);
    gl_FragColor = vec4(uColor, 1.0) * intensity * pulse;
  }
`;

function Planet() {
  const bodyRef = useRef<THREE.ShaderMaterial>(null);
  const atmoRef = useRef<THREE.ShaderMaterial>(null);
  const time = useRef(0);

  const bodyUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#070f26') },
      uMid: { value: new THREE.Color('#12305f') },
      uRim: { value: new THREE.Color('#1f7fd0') },
    }),
    []
  );
  const atmoUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color('#3fd8f7') } }),
    []
  );

  useFrame((_, delta) => {
    time.current += step(delta);
    if (bodyRef.current) bodyRef.current.uniforms.uTime.value = time.current;
    if (atmoRef.current) atmoRef.current.uniforms.uTime.value = time.current;
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          ref={bodyRef}
          vertexShader={bodyVertex}
          fragmentShader={bodyFragment}
          uniforms={bodyUniforms}
        />
      </mesh>
      <mesh scale={1.13}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <shaderMaterial
          ref={atmoRef}
          vertexShader={bodyVertex}
          fragmentShader={atmoFragment}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Точечная оболочка                                                  */
/* ------------------------------------------------------------------ */

function DotShell({ count = 2600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const time = useRef(0);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      positions[i * 3] = Math.cos(theta) * r * RADIUS * 1.006;
      positions[i * 3 + 1] = y * RADIUS * 1.006;
      positions[i * 3 + 2] = Math.sin(theta) * r * RADIUS * 1.006;
      phases[i] = (i * 2.399963) % (Math.PI * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return g;
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    time.current += step(delta);
    const mat = ref.current?.material as THREE.ShaderMaterial | undefined;
    if (mat) mat.uniforms.uTime.value = time.current;
  });

  return (
    <points ref={ref} geometry={geometry} raycast={() => null}>
      <shaderMaterial
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float aPhase;
          uniform float uTime;
          varying float vAlpha;
          void main() {
            float pulse = 0.5 + 0.5 * sin(uTime * 0.9 + aPhase);
            vAlpha = 0.12 + pulse * 0.32;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.1 + pulse * 1.3) * (9.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying float vAlpha;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            if (d > 0.5) discard;
            float soft = smoothstep(0.5, 0.05, d);
            gl_FragColor = vec4(mix(vec3(0.35,0.85,1.0), vec3(0.65,0.55,1.0), vAlpha), soft * vAlpha);
          }
        `}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Сетка параллелей и меридианов                                      */
/* ------------------------------------------------------------------ */

function Graticule() {
  const lines = useMemo(() => {
    const segs: THREE.Vector3[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lon = -180; lon <= 180; lon += 4) pts.push(toVec3(lat, lon, RADIUS * 1.002));
      segs.push(pts);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(toVec3(lat, lon, RADIUS * 1.002));
      segs.push(pts);
    }
    return segs;
  }, []);

  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#4fd6ff" lineWidth={0.6} transparent opacity={0.14} raycast={() => null} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Дуги «потоков данных» между городами                               */
/* ------------------------------------------------------------------ */

function Arc({ from, to, color, delay }: {
  from: [number, number]; to: [number, number]; color: string; delay: number;
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);
  const time = useRef(0);
  const points = useMemo(() => {
    const a = toVec3(from[0], from[1]);
    const b = toVec3(to[0], to[1]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = 1 + a.distanceTo(b) * 0.28;
    mid.normalize().multiplyScalar(RADIUS * lift);
    return new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(64);
  }, [from, to]);

  useFrame((_, delta) => {
    time.current += step(delta);
    if (matRef.current) {
      const t = (time.current * 0.55 + delay) % 3;
      matRef.current.opacity = t < 1.6 ? 0.15 + Math.sin((t / 1.6) * Math.PI) * 0.6 : 0.08;
    }
  });

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial ref={matRef} color={color} transparent opacity={0.4} />
    </line>
  );
}

/* ------------------------------------------------------------------ */
/*  Столицы мира — одно облако точек + подпись под курсором            */
/* ------------------------------------------------------------------ */

interface CityHit { city: WorldCity; index: number }

function CityField({
  onHover, onPick, hovered, selected,
}: {
  onHover: (hit: CityHit | null) => void;
  onPick: (hit: CityHit) => void;
  hovered: number | null;
  selected: number | null;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const time = useRef(0);

  const geometry = useMemo(() => {
    const positions = new Float32Array(WORLD_CITIES.length * 3);
    const weight = new Float32Array(WORLD_CITIES.length);
    // gl_VertexID есть только в GLSL ES 3.00, а three.js компилирует шейдеры
    // как ES 1.00 — поэтому номер точки везём обычным атрибутом.
    const index = new Float32Array(WORLD_CITIES.length);
    // столицы светятся тёплым, мегаполисы — холодным
    const kind = new Float32Array(WORLD_CITIES.length);
    WORLD_CITIES.forEach((c, i) => {
      const v = toVec3(c.lat, c.lon, RADIUS * 1.012);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      weight[i] = c.major ? 1 : 0;
      index[i] = i;
      kind[i] = c.kind === 'capital' ? 1 : 0;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aMajor', new THREE.BufferAttribute(weight, 1));
    g.setAttribute('aIndex', new THREE.BufferAttribute(index, 1));
    g.setAttribute('aCapital', new THREE.BufferAttribute(kind, 1));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uHovered: { value: -1 }, uSelected: { value: -1 } }),
    []
  );

  useFrame((_, delta) => {
    time.current += step(delta);
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = time.current;
    matRef.current.uniforms.uHovered.value = hovered ?? -1;
    matRef.current.uniforms.uSelected.value = selected ?? -1;
  });

  /** Метки на дальней стороне шара не должны перехватывать курсор. */
  const frontFacing = (e: ThreeEvent<PointerEvent>, index: number) => {
    const obj = e.object as THREE.Points;
    const local = new THREE.Vector3().fromBufferAttribute(
      obj.geometry.getAttribute('position') as THREE.BufferAttribute,
      index
    );
    const world = local.clone().applyMatrix4(obj.matrixWorld);
    const normal = world.clone().sub(obj.getWorldPosition(new THREE.Vector3())).normalize();
    const toCam = e.camera.position.clone().sub(world).normalize();
    return normal.dot(toCam) > 0.08;
  };

  const pickIndex = (e: ThreeEvent<PointerEvent>): number | null => {
    // Луч по облаку точек возвращает все попадания в порядке удаления —
    // берём ближайшее, но только с обращённой к камере стороны.
    for (const hit of e.intersections) {
      if (hit.object !== e.object || hit.index == null) continue;
      if (frontFacing(e, hit.index)) return hit.index;
    }
    return e.index != null && frontFacing(e, e.index) ? e.index : null;
  };

  return (
    <points
      geometry={geometry}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        const index = pickIndex(e);
        if (index == null) { onHover(null); return; }
        e.stopPropagation();
        onHover({ city: WORLD_CITIES[index], index });
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e: ThreeEvent<PointerEvent>) => {
        const index = pickIndex(e);
        if (index == null) return;
        e.stopPropagation();
        onPick({ city: WORLD_CITIES[index], index });
      }}
    >
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float aMajor;
          attribute float aIndex;
          attribute float aCapital;
          uniform float uTime;
          uniform float uHovered;
          uniform float uSelected;
          varying float vAlpha;
          varying float vActive;
          varying float vCapital;

          void main() {
            vCapital = aCapital;
            vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
            vec3 worldNormal = normalize(mat3(modelMatrix) * normalize(position));
            vec3 toCam = normalize(cameraPosition - worldPos);
            // гасим точки, ушедшие на обратную сторону шара
            float facing = smoothstep(-0.02, 0.3, dot(worldNormal, toCam));

            // active — зарезервированное слово в GLSL ES, компилятор его не пропускает
            float hot = 0.0;
            if (abs(aIndex - uHovered) < 0.5) hot = 1.0;
            if (abs(aIndex - uSelected) < 0.5) hot = 1.0;
            vActive = hot;

            float pulse = 0.82 + 0.18 * sin(uTime * 1.6 + aIndex);
            vAlpha = facing * (0.72 + aMajor * 0.28) * pulse + hot * facing * 0.5;

            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (4.6 + aMajor * 3.2 + hot * 5.0) * (14.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying float vAlpha;
          varying float vActive;
          varying float vCapital;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            if (d > 0.5) discard;
            // тёплое ядро с ореолом — так столицы не сливаются с холодной
            // голубой оболочкой планеты
            float core = smoothstep(0.34, 0.05, d);
            float halo = smoothstep(0.5, 0.2, d) * 0.45;
            // столицы — янтарные, мегаполисы — бирюзовые
            vec3 base = mix(vec3(0.45, 0.88, 1.0), vec3(1.0, 0.82, 0.45), vCapital);
            vec3 col = mix(base, vec3(1.0, 0.97, 0.8), vActive);
            gl_FragColor = vec4(col, (core + halo) * vAlpha);
          }
        `}
      />
    </points>
  );
}

/** Подпись столицы, висящая рядом с точкой. */
function CityLabel({ city, dim = false }: { city: WorldCity; dim?: boolean }) {
  const pos = useMemo(() => toVec3(city.lat, city.lon, RADIUS * 1.03), [city]);
  return (
    <group position={pos}>
      <Html center distanceFactor={5.6} zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            transform: 'translateY(-26px)',
            whiteSpace: 'nowrap',
            padding: '5px 11px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: '#f4f9ff',
            background: 'rgba(6,12,26,.82)',
            border: `1px solid ${dim ? 'rgba(125,242,255,.28)' : 'rgba(251,191,36,.55)'}`,
            boxShadow: `0 0 20px -6px ${dim ? '#7df2ff' : '#fbbf24'}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {city.name}
          <span style={{ color: 'rgba(200,220,245,.6)', marginLeft: 7, fontWeight: 600 }}>
            {city.country}
          </span>
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Витринные метки с живой температурой                               */
/* ------------------------------------------------------------------ */

interface MarkerSlot {
  group: THREE.Group | null;
  label: HTMLDivElement | null;
}

/**
 * Раскладывает подписи так, чтобы они не наезжали друг на друга.
 *
 * Раньше каждая метка решала сама за себя — видна, если смотрит на камеру.
 * Рядом стоящие города (Лондон, Нью-Йорк, Рейкьявик) сходились в одну кучу
 * пилюль. Теперь проецируем все метки в экранные координаты и жадно оставляем
 * те, что не пересекаются: ближе к центру диска — выше приоритет.
 */
function LabelArbiter({ slots }: { slots: React.MutableRefObject<MarkerSlot[]> }) {
  const world = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const candidates: { i: number; x: number; y: number; facing: number }[] = [];

    slots.current.forEach((slot, i) => {
      if (!slot?.group) return;
      slot.group.getWorldPosition(world);
      const facing = world.clone().normalize().dot(camera.position.clone().sub(world).normalize());
      // точка на обратной стороне шара не рисуется вовсе
      slot.group.visible = facing > 0.05;
      if (facing <= 0.18) return;

      ndc.copy(world).project(camera);
      candidates.push({
        i,
        x: (ndc.x * 0.5 + 0.5) * size.width,
        y: (-ndc.y * 0.5 + 0.5) * size.height,
        facing,
      });
    });

    // самые «фронтальные» занимают место первыми
    candidates.sort((a, b) => b.facing - a.facing);

    const taken: { x: number; y: number }[] = [];
    const HALF_W = 78;   // половина типичной ширины пилюли, px
    const HALF_H = 17;
    const shown = new Set<number>();

    for (const c of candidates) {
      const clash = taken.some(
        (t) => Math.abs(t.x - c.x) < HALF_W * 2 && Math.abs(t.y - c.y) < HALF_H * 2
      );
      if (clash) continue;
      taken.push({ x: c.x, y: c.y });
      shown.add(c.i);
    }

    slots.current.forEach((slot, i) => {
      if (!slot?.label) return;
      const visible = shown.has(i);
      // плавное появление вместо мигания при вращении
      slot.label.style.opacity = visible ? '1' : '0';
      slot.label.style.transition = 'opacity .22s ease';
    });
  });

  return null;
}

function Marker({
  marker, index, slots, onSelect,
}: {
  marker: GlobeMarker;
  index: number;
  slots: React.MutableRefObject<MarkerSlot[]>;
  onSelect?: (m: GlobeMarker) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const scale = useRef(1);
  const time = useRef(0);
  const pos = useMemo(() => toVec3(marker.lat, marker.lon, RADIUS * 1.02), [marker.lat, marker.lon]);
  const color = marker.color ?? '#7df2ff';

  useFrame((_, delta) => {
    const dt = step(delta);
    time.current += dt;

    slots.current[index] = { group: groupRef.current, label: labelRef.current };

    const t = (time.current * 0.8 + marker.lat) % 2.2;
    if (ringRef.current) {
      const s = 0.03 + t * 0.05;
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 - t * 0.35);
    }

    // Экспоненциальное сглаживание вместо шага «на кадр»: скорость одинакова
    // и на 60, и на 144 Гц.
    scale.current = THREE.MathUtils.damp(scale.current, hovered ? 1.12 : 1, 12, dt);
    if (labelRef.current) {
      labelRef.current.style.transform = `translateY(-28px) scale(${scale.current.toFixed(3)})`;
    }
  });

  return (
    <group ref={groupRef} position={pos}>
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onSelect?.(marker); }}
      >
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ringRef} lookAt={[0, 0, 0]} raycast={() => null}>
        <ringGeometry args={[0.6, 1, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <Html center distanceFactor={5.6} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div
          ref={labelRef}
          style={{
            transform: 'translateY(-28px)',
            whiteSpace: 'nowrap',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.02em',
            color: '#e9f4ff',
            background: 'rgba(6,12,26,.72)',
            border: `1px solid ${color}55`,
            boxShadow: `0 0 18px -6px ${color}`,
            backdropFilter: 'blur(6px)',
          }}
        >
          {marker.label}
          {marker.value ? <span style={{ color, marginLeft: 6 }}>{marker.value}</span> : null}
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Орбитальное кольцо со спутником                                    */
/* ------------------------------------------------------------------ */

function OrbitRing() {
  const g = useRef<THREE.Group>(null);
  const sat = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    time.current += step(delta);
    const t = time.current;
    if (g.current) g.current.rotation.z = t * 0.12;
    if (sat.current) sat.current.position.set(Math.cos(t * 0.55) * 2.85, Math.sin(t * 0.55) * 2.85, 0);
  });
  return (
    <group ref={g} rotation={[Math.PI / 2.6, 0.4, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[2.85, 0.004, 8, 128]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.45} />
      </mesh>
      <mesh ref={sat} raycast={() => null}>
        <boxGeometry args={[0.07, 0.03, 0.03]} />
        <meshBasicMaterial color="#f472b6" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Телепорт: плавный перелёт камеры к точке                           */
/* ------------------------------------------------------------------ */

/**
 * Доворачивает камеру так, чтобы заданная точка оказалась в центре диска.
 *
 * Идём не по прямой в пространстве, а по сфере: интерполируем азимут и
 * наклонение (Lerp по кратчайшей дуге) — так планета поворачивается, а не
 * «проваливается» мимо камеры. Экспоненциальное сглаживание вместо шага на
 * кадр держит одинаковую скорость на любой частоте обновления.
 */
function FocusController({ target, onArrive }: {
  target: { lat: number; lon: number } | null;
  onArrive?: () => void;
}) {
  const controls = useThree((st) => st.controls) as
    | { object: THREE.Camera; target: THREE.Vector3; update: () => void; enabled: boolean }
    | null;
  const goal = useRef<THREE.Spherical | null>(null);
  const arrived = useRef(true);

  useEffect(() => {
    if (!target) { goal.current = null; return; }
    // точка на поверхности -> направление, откуда на неё смотреть
    const dir = toVec3(target.lat, target.lon, 1).normalize();
    const sph = new THREE.Spherical().setFromVector3(dir);
    goal.current = sph;
    arrived.current = false;
  }, [target?.lat, target?.lon]);

  useFrame((state, delta) => {
    const g = goal.current;
    if (!g || !controls) return;

    const cam = controls.object;
    const current = new THREE.Spherical().setFromVector3(
      cam.position.clone().sub(controls.target)
    );

    // кратчайший путь по азимуту: без этого камера едет «вокруг мира»
    let dTheta = g.theta - current.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;

    const k = 1 - Math.exp(-3.2 * step(delta));
    current.theta += dTheta * k;
    current.phi = THREE.MathUtils.lerp(current.phi, g.phi, k);
    current.radius = THREE.MathUtils.lerp(current.radius, 6.2, k);
    current.makeSafe();

    cam.position.setFromSpherical(current).add(controls.target);
    cam.lookAt(controls.target);
    controls.update();

    if (!arrived.current && Math.abs(dTheta) < 0.01 && Math.abs(current.phi - g.phi) < 0.01) {
      arrived.current = true;
      onArrive?.();
    }
    void state;
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Сцена                                                             */
/* ------------------------------------------------------------------ */

function Scene({
  markers, onSelect, onCitySelect, showCities, enableZoom, focus, onFocusArrive,
}: {
  markers: GlobeMarker[];
  onSelect?: (m: GlobeMarker) => void;
  onCitySelect?: (c: WorldCity) => void;
  showCities: boolean;
  enableZoom: boolean;
  focus?: { lat: number; lon: number } | null;
  onFocusArrive?: () => void;
}) {
  const reportDrag = useDragReporter();
  const [hovered, setHovered] = useState<CityHit | null>(null);
  const [selected, setSelected] = useState<CityHit | null>(null);
  // общий буфер меток для арбитра подписей
  const slots = useRef<MarkerSlot[]>([]);

  const arcs = useMemo(() => {
    const base: [number, number][] = markers.length
      ? markers.map((m) => [m.lat, m.lon] as [number, number])
      : [[50.45, 30.52], [51.5, -0.13], [35.69, 139.69], [40.71, -74.0], [-33.87, 151.2]];
    const pairs: { from: [number, number]; to: [number, number]; color: string; delay: number }[] = [];
    const palette = ['#7df2ff', '#a78bfa', '#f472b6', '#4ade80'];
    for (let i = 0; i < base.length; i++) {
      pairs.push({
        from: base[i], to: base[(i + 2) % base.length],
        color: palette[i % palette.length], delay: i * 0.55,
      });
    }
    return pairs;
  }, [markers]);

  const pickCity = useCallback((hit: CityHit) => {
    setSelected((prev) => (prev?.index === hit.index ? null : hit));
    onCitySelect?.(hit.city);
  }, [onCitySelect]);

  return (
    <>
      {/* Никакого autoRotate: глобус двигается только когда его тянут. */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={enableZoom}
        autoRotate={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.55}
        zoomSpeed={0.6}
        minDistance={4.6}
        maxDistance={13}
        onStart={() => reportDrag(true)}
        onEnd={() => reportDrag(false)}
      />

      <FocusController target={focus ?? null} onArrive={onFocusArrive} />

      <ambientLight intensity={0.8} />
      <pointLight position={[5, 3, 5]} intensity={35} color="#7df2ff" />
      <pointLight position={[-5, -2, -4]} intensity={22} color="#8b5cf6" />
      <Stars radius={60} depth={40} count={2600} factor={3.2} saturation={0} fade speed={0.7} />

      <group>
        <Planet />
        <DotShell />
        <Graticule />
        {arcs.map((a, i) => <Arc key={i} {...a} />)}

        {showCities && (
          <>
            <CityField
              onHover={setHovered}
              onPick={pickCity}
              hovered={hovered?.index ?? null}
              selected={selected?.index ?? null}
            />
            {selected && <CityLabel city={selected.city} />}
            {hovered && hovered.index !== selected?.index && (
              <CityLabel city={hovered.city} dim />
            )}
          </>
        )}

        {markers.map((m, i) => (
          <Marker key={`${m.lat}-${m.lon}`} marker={m} index={i} slots={slots} onSelect={onSelect} />
        ))}
        <LabelArbiter slots={slots} />
      </group>

      <OrbitRing />
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function Globe3D({
  markers = [],
  onSelect,
  onCitySelect,
  showCities = true,
  enableZoom = false,
  focus = null,
  onFocusArrive,
  onDragChange,
  hint,
  className = '',
}: {
  markers?: GlobeMarker[];
  onSelect?: (m: GlobeMarker) => void;
  /** Клик по метке города — открываем сводку погоды. */
  onCitySelect?: (c: WorldCity) => void;
  showCities?: boolean;
  /** На лендинге включается после первого касания, чтобы колесо сначала листало страницу. */
  enableZoom?: boolean;
  /** Точка, к которой камера плавно доворачивается («телепорт»). */
  focus?: { lat: number; lon: number } | null;
  onFocusArrive?: () => void;
  onDragChange?: (dragging: boolean) => void;
  hint?: string | false;
  className?: string;
}) {
  return (
    <GlobeCanvas className={className} hint={hint} onDragChange={onDragChange}>
      <Scene
        markers={markers}
        onSelect={onSelect}
        onCitySelect={onCitySelect}
        showCities={showCities}
        enableZoom={enableZoom}
        focus={focus}
        onFocusArrive={onFocusArrive}
      />
    </GlobeCanvas>
  );
}
