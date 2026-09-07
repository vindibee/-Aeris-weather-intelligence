import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

export interface PlanetVisual {
  deep: string;
  mid: string;
  rim: string;
  atmosphere: string;
  atmoStrength: number;
  /** 0 — каменистая поверхность, >0 — число широтных полос газового гиганта. */
  bands: number;
  /** Насколько выражены пятна/кратеры поверхности. */
  mottle: number;
  ring: { inner: number; outer: number; color: string; tilt: number } | null;
}

const RADIUS = 1.6;

/* ------------------------------------------------------------------ */
/*  Шейдеры                                                            */
/* ------------------------------------------------------------------ */

const surfaceVertex = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vLocal = position;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Поверхность рисуется процедурно: текстур в проекте нет, а тянуть их со
 * сторонних хостов ради восьми планет не хочется. Полосы газовых гигантов —
 * синус по широте, каменистые тела — фрактальный шум.
 */
const surfaceFragment = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uRim;
  uniform float uBands;
  uniform float uMottle;
  uniform float uClimate;
  uniform float uDetail;
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    // шесть октав в крупном режиме, четыре в карточке — мелкие детали всё
    // равно не видно на превью 250 px, а кадр они удорожают
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uDetail) break;
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 n = normalize(vLocal);
    float detail = fbm(n * 4.2);

    float pattern;
    if (uBands > 0.5) {
      // широтные пояса, слегка размытые турбулентностью
      pattern = 0.5 + 0.5 * sin(n.y * uBands * 3.14159 + detail * 1.6);
    } else {
      pattern = 0.5 + 0.42 * n.y;
    }
    float t = clamp(pattern * 0.78 + (detail - 0.5) * uMottle * 1.35, 0.0, 1.0);
    vec3 base = mix(uDeep, uMid, t);

    vec3 lightDir = normalize(vec3(0.72, 0.42, 0.85));
    float diff = clamp(dot(normalize(vWorldNormal), lightDir), 0.0, 1.0);
    // мягкий терминатор вместо резкой границы дня и ночи
    float lit = 0.18 + smoothstep(0.0, 0.55, diff) * 1.02;

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 3.0);

    vec3 color = base * lit;
    color = mix(color, uRim, fres * 0.42 * (0.25 + diff));

    /*
     * Климатические пояса.
     *
     * Широта задаёт градиент «экватор горячий -> полюс ледяной», а на границах
     * тропиков (23.5°) и полярных кругов (66.5°) подсвечиваются тонкие линии —
     * так видно не только плавный переход, но и сами пояса.
     */
    if (uClimate > 0.001) {
      float band = abs(n.y);
      vec3 equator = vec3(1.0, 0.38, 0.16);
      vec3 temperate = vec3(0.98, 0.86, 0.32);
      vec3 polar = vec3(0.62, 0.88, 1.0);
      vec3 zone = band < 0.5
        ? mix(equator, temperate, band * 2.0)
        : mix(temperate, polar, (band - 0.5) * 2.0);

      float tropic = 1.0 - smoothstep(0.0, 0.012, abs(band - 0.399));
      float circle = 1.0 - smoothstep(0.0, 0.012, abs(band - 0.917));
      zone = mix(zone, vec3(1.0), max(tropic, circle) * 0.75);

      color = mix(color, zone * (0.45 + lit * 0.55), uClimate * 0.62);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vLocal;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = 1.0 - abs(dot(normalize(vWorldNormal), viewDir));
    float intensity = pow(rim, 3.0) * uStrength;
    gl_FragColor = vec4(uColor, 1.0) * intensity;
  }
`;

const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vUvPos;

  float hash(float x) { return fract(sin(x * 91.3458) * 47453.5453); }

  void main() {
    float r = length(vUvPos);
    if (r < uInner || r > uOuter) discard;
    float k = (r - uInner) / max(0.0001, uOuter - uInner);
    // щели Кассини и общая полосатость колец
    float bands = 0.55 + 0.45 * sin(k * 46.0);
    float gap = smoothstep(0.42, 0.46, k) * (1.0 - smoothstep(0.5, 0.54, k));
    float alpha = bands * (0.16 + hash(floor(k * 60.0)) * 0.3);
    alpha *= 1.0 - gap * 0.85;
    alpha *= smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.9, 1.0, k));
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const ringVertex = /* glsl */ `
  varying vec2 vUvPos;
  void main() {
    vUvPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ------------------------------------------------------------------ */

function Body({ visual, climate, detail }: {
  visual: PlanetVisual;
  climate: boolean;
  detail: number;
}) {
  const surfaceRef = useRef<THREE.ShaderMaterial>(null);
  const climateValue = useRef(0);

  // Переключение поясов плавное: резкая смена палитры на весь диск выглядит
  // как артефакт, а не как режим отображения.
  useFrame((_, delta) => {
    const mat = surfaceRef.current;
    if (!mat) return;
    const k = 1 - Math.exp(-6 * Math.min(delta, 1 / 30));
    climateValue.current += ((climate ? 1 : 0) - climateValue.current) * k;
    mat.uniforms.uClimate.value = climateValue.current;
    mat.uniforms.uDetail.value = detail;
  });

  const surfaceUniforms = useMemo(
    () => ({
      uDeep: { value: new THREE.Color(visual.deep) },
      uMid: { value: new THREE.Color(visual.mid) },
      uRim: { value: new THREE.Color(visual.rim) },
      uBands: { value: visual.bands },
      uMottle: { value: visual.mottle },
      uClimate: { value: 0 },
      uDetail: { value: 4 },
    }),
    [visual]
  );

  const atmoUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(visual.atmosphere) },
      uStrength: { value: visual.atmoStrength },
    }),
    [visual]
  );

  const ringUniforms = useMemo(
    () =>
      visual.ring
        ? {
            uColor: { value: new THREE.Color(visual.ring.color) },
            uInner: { value: visual.ring.inner * RADIUS },
            uOuter: { value: visual.ring.outer * RADIUS },
          }
        : null,
    [visual]
  );

  return (
    <group>
      <mesh>
        <sphereGeometry args={[RADIUS, detail >= 5 ? 128 : 64, detail >= 5 ? 96 : 64]} />
        <shaderMaterial
          ref={surfaceRef}
          vertexShader={surfaceVertex}
          fragmentShader={surfaceFragment}
          uniforms={surfaceUniforms}
        />
      </mesh>

      {visual.atmoStrength > 0.05 && (
        <mesh scale={1.1} raycast={() => null}>
          <sphereGeometry args={[RADIUS, 40, 40]} />
          <shaderMaterial
            vertexShader={surfaceVertex}
            fragmentShader={atmosphereFragment}
            uniforms={atmoUniforms}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {visual.ring && ringUniforms && (
        <mesh rotation={[Math.PI / 2 - visual.ring.tilt, 0, 0.2]} raycast={() => null}>
          <ringGeometry args={[visual.ring.inner * RADIUS, visual.ring.outer * RADIUS, 128]} />
          <shaderMaterial
            vertexShader={ringVertex}
            fragmentShader={ringFragment}
            uniforms={ringUniforms}
            side={THREE.DoubleSide}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

/** Редкие звёзды фоном — дешевле drei Stars, которых тут было бы восемь копий. */
function Sparks({ count = 160, spread = 26 }: { count?: number; spread?: number }) {
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // детерминированное псевдослучайное размещение: одинаково при каждом
      // монтировании, никаких прыжков между перерисовками
      const a = i * 2.399963;
      const r = spread * (0.55 + ((i * 37) % 100) / 220);
      const y = ((i * 61) % 100) / 50 - 1;
      const s = Math.sqrt(Math.max(0, 1 - y * y));
      pos[i * 3] = Math.cos(a) * s * r;
      pos[i * 3 + 1] = y * r;
      pos[i * 3 + 2] = Math.sin(a) * s * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, spread]);

  return (
    <points geometry={geometry} raycast={() => null}>
      <pointsMaterial size={0.09} color="#cbd5f5" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

/* ------------------------------------------------------------------ */

export interface PlanetSceneProps {
  visual: PlanetVisual;
  /** Дистанция камеры: карточки в сетке смотрят чуть дальше, чем модалка. */
  distance?: number;
  enableZoom?: boolean;
  onDragChange?: (dragging: boolean) => void;
  /**
   * Элемент, на который контроллер вешает свои DOM-слушатели.
   *
   * В сетке планет все глобусы живут в одном общем Canvas, а тот растянут на
   * вьюпорт и помечен pointer-events: none — иначе он перехватывал бы клики по
   * всей странице. Без явного domElement OrbitControls подписался бы как раз на
   * этот «прозрачный для мыши» canvas и не увидел бы ни одного жеста.
   */
  domElement?: HTMLElement | null;
  /** Подсветка климатических поясов: экватор тёплый, полюса ледяные. */
  climate?: boolean;
  /** Медленное автовращение. По умолчанию выключено — планета стоит, пока её не тронут. */
  autoRotate?: boolean;
  /** Обороты автовращения в минуту. */
  autoRotateSpeed?: number;
  /** Число октав шума и плотность сетки: 4 — карточка, 6 — крупный режим. */
  detail?: number;
}

/** 3D-содержимое планеты без собственного Canvas — годится и для drei View. */
export function PlanetScene({
  visual, distance = 5, enableZoom = false, onDragChange, domElement,
  climate = false, autoRotate = false, autoRotateSpeed = 0.35, detail = 4,
}: PlanetSceneProps) {
  /*
   * Позицию камеры держим стабильной ссылкой.
   *
   * R3F переприменяет пропсы, когда меняется их идентичность. Литерал массива
   * рождается заново на каждом рендере, и любая перерисовка родителя (у нас —
   * подсветка курсора при захвате) возвращала камеру в исходную точку, стирая
   * поворот, который пользователь только что сделал мышью.
   */
  const cameraPos = useMemo<[number, number, number]>(() => [0, 0.5, distance], [distance]);

  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPos} fov={38} />
      {/* Вращение только руками: ни autoRotate, ни параллакса по курсору. */}
      <OrbitControls
        makeDefault
        domElement={domElement ?? undefined}
        enablePan={false}
        enableZoom={enableZoom}
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        minDistance={3.2}
        maxDistance={9}
        onStart={() => onDragChange?.(true)}
        onEnd={() => onDragChange?.(false)}
      />
      <ambientLight intensity={0.55} />
      <pointLight position={[6, 4, 6]} intensity={40} color="#fff6e8" />
      <pointLight position={[-6, -3, -5]} intensity={12} color="#6c7cff" />
      <Sparks />
      <Body visual={visual} climate={climate} detail={detail} />
    </>
  );
}

/** Готовый самостоятельный виджет — используется в модальной карточке. */
/**
 * Самостоятельный виджет планеты со своим Canvas.
 *
 * frameloop="demand" здесь принципиален: планета ничего не анимирует сама,
 * поэтому кадры считаются только пока её крутят (OrbitControls дергает
 * invalidate на каждое изменение). Восемь простаивающих карточек не жгут GPU.
 */
export default function PlanetGlobe({
  visual, className = '', distance = 4.6, enableZoom = true, dpr = 1.6,
  climate = false, autoRotate = false, autoRotateSpeed = 0.35, detail = 4,
  alwaysRender = false,
}: {
  visual: PlanetVisual;
  className?: string;
  distance?: number;
  enableZoom?: boolean;
  dpr?: number;
  climate?: boolean;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  detail?: number;
  /**
   * Непрерывный рендер вместо кадров по требованию.
   *
   * В режиме demand кадр рисуется только по запросу, поэтому плавное включение
   * климатических поясов (оно идёт в useFrame) просто не отрисовывалось бы:
   * кнопка загоралась, а планета оставалась прежней.
   */
  alwaysRender?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <Canvas
        frameloop={autoRotate || alwaysRender ? 'always' : 'demand'}
        dpr={[1, dpr]}
        resize={{ scroll: false, debounce: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'pan-y' }}
      >
        <PlanetScene
          visual={visual}
          distance={distance}
          enableZoom={enableZoom}
          onDragChange={setDragging}
          climate={climate}
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          detail={detail}
        />
      </Canvas>
    </div>
  );
}
