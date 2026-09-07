import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Outfit } from '../../lib/outfit';

/**
 * Безликий манекен для «Одеватора».
 *
 * Тело — тело вращения (LatheGeometry) по сглаженному профилю, конечности —
 * капсулы. Получается гладкая витринная фигура без лица, а не сборка из
 * коробок, как было раньше.
 *
 * Почему не готовая .glb-модель: доступные модели персонажей идут с запечённой
 * текстурой одежды и лицом. Перекрасить на них куртку и шапку по слотам
 * невозможно, а это и есть смысл раздела. Точка расширения оставлена — если
 * появится подходящий безликий манекен, его подхватит `modelUrl` через drei.
 */

export type Gender = 'male' | 'female';

const SKIN = '#d9cdc0';

interface Proportions {
  height: number;
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  headR: number;
  limb: number;
}

const PROPS: Record<Gender, Proportions> = {
  male:   { height: 1.0,  shoulder: 0.26,  chest: 0.24, waist: 0.205, hip: 0.215, headR: 0.115, limb: 0.064 },
  // у женской фигуры уже плечи, заметнее талия и шире бёдра — силуэт читается
  // с одного взгляда, без опоры на причёску или лицо
  female: { height: 0.92, shoulder: 0.185, chest: 0.19, waist: 0.145, hip: 0.235, headR: 0.104, limb: 0.05 },
};

/**
 * Профиль торса для тела вращения: пары «радиус — высота» снизу вверх.
 * Кривая Каттмулла-Рома сглаживает переходы, поэтому силуэт получается
 * непрерывным, без рёбер между сегментами.
 */
function torsoProfile(p: Proportions): THREE.Vector2[] {
  const raw: [number, number][] = [
    [p.hip * 0.55, 0.0],
    [p.hip, 0.06],
    [p.waist, 0.26],
    [p.chest, 0.46],
    [p.shoulder, 0.6],
    [p.shoulder * 0.72, 0.66],
    [p.shoulder * 0.34, 0.7],
  ];
  const curve = new THREE.CatmullRomCurve3(
    raw.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    false,
    'catmullrom',
    0.4
  );
  return curve.getPoints(28).map((v) => new THREE.Vector2(Math.max(0.008, v.x), v.y));
}

function useTorsoGeometry(p: Proportions) {
  return useMemo(() => {
    const g = new THREE.LatheGeometry(torsoProfile(p), 40);
    g.computeVertexNormals();
    return g;
  }, [p]);
}

/* ------------------------------------------------------------------ */

const has = (outfit: Outfit, re: RegExp) => outfit.items.some((i) => re.test(i.label));

interface MannequinProps {
  outfit: Outfit;
  gender: Gender;
  /** Путь к собственной .glb-модели манекена. Если задан — грузится через drei. */
  modelUrl?: string;
}

function GltfMannequin({ url, tint }: { url: string; tint: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.65 });
    });
    return copy;
  }, [scene, tint]);
  return <primitive object={cloned} />;
}

export default function Mannequin({ outfit, gender, modelUrl }: MannequinProps) {
  const p = PROPS[gender];
  const torso = useTorsoGeometry(p);
  const { palette } = outfit;

  const wearsHat = !!palette.head && has(outfit, /Шапка|Кепка|Панама|Капюшон|балаклава/i);
  const wearsScarf = has(outfit, /Шарф/i);
  const wearsGlasses = has(outfit, /очки/i);
  const wearsGloves = has(outfit, /Перчатки|Варежки/i);
  const wearsShorts = has(outfit, /Шорты/i);

  const legTop = 0.0;
  const legLen = p.height * 0.52;
  const torsoBase = legTop + legLen * 0.94;
  const headY = torsoBase + 0.7 * 1 + p.headR * 0.5;

  if (modelUrl) {
    return (
      <group position={[0, -p.height * 0.78, 0]}>
        <GltfMannequin url={modelUrl} tint={palette.outer} />
      </group>
    );
  }

  return (
    <group position={[0, -p.height * 0.78, 0]}>
      {/* ---------- ноги ---------- */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * p.hip * 0.42, legTop, 0]}>
          <mesh position={[0, legLen / 2, 0]}>
            <capsuleGeometry args={[p.limb, legLen - p.limb * 2, 6, 20]} />
            <meshStandardMaterial
              color={wearsShorts ? SKIN : palette.legs}
              roughness={0.82}
            />
          </mesh>
          {/* шорты — короткий верхний слой поверх ноги */}
          {wearsShorts && (
            <mesh position={[0, legLen * 0.78, 0]}>
              <capsuleGeometry args={[p.limb * 1.16, legLen * 0.26, 5, 18]} />
              <meshStandardMaterial color={palette.legs} roughness={0.8} />
            </mesh>
          )}
          {/* Обувь: капсулу кладём набок поворотом меша — у геометрии своего
              поворота нет. Носок вынесен вперёд, иначе читается как лодыжка. */}
          <mesh position={[0, p.limb * 0.7, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[p.limb * 0.95, 0.17, 6, 18]} />
            <meshStandardMaterial color={palette.shoes} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* ---------- торс ---------- */}
      <group position={[0, torsoBase, 0]}>
        <mesh geometry={torso}>
          <meshStandardMaterial color={palette.outer} roughness={0.72} />
        </mesh>

        {/* ---------- руки ---------- */}
        {[-1, 1].map((side) => (
          <group
            key={side}
            position={[side * (p.shoulder * 0.92), 0.56, 0]}
            rotation={[0, 0, side * 0.1]}
          >
            <mesh position={[0, -0.2, 0]}>
              <capsuleGeometry args={[p.limb * 0.86, 0.36, 6, 18]} />
              <meshStandardMaterial color={palette.outer} roughness={0.75} />
            </mesh>
            <mesh position={[0, -0.43, 0]}>
              <sphereGeometry args={[p.limb * 0.92, 18, 14]} />
              <meshStandardMaterial
                color={wearsGloves ? (palette.head ?? '#3f3f46') : SKIN}
                roughness={0.85}
              />
            </mesh>
          </group>
        ))}

        {/* ---------- шея ---------- */}
        <mesh position={[0, 0.72, 0]}>
          <capsuleGeometry args={[p.headR * 0.42, 0.06, 5, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>

        {/* ---------- голова: гладкая, без черт лица ---------- */}
        <mesh position={[0, 0.72 + p.headR * 1.05, 0]} scale={[1, 1.14, 1.02]}>
          <sphereGeometry args={[p.headR, 32, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.82} />
        </mesh>

        {/* ---------- шарф ---------- */}
        {wearsScarf && (
          <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[p.headR * 0.58, 0.028, 12, 26]} />
            <meshStandardMaterial color="#c0392b" roughness={0.9} />
          </mesh>
        )}

        {/* ---------- головной убор ---------- */}
        {wearsHat && palette.head && (
          <group position={[0, 0.72 + p.headR * 1.32, 0]}>
            <mesh scale={[1, 0.82, 1.02]}>
              <sphereGeometry args={[p.headR * 1.09, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshStandardMaterial color={palette.head} roughness={0.78} side={THREE.DoubleSide} />
            </mesh>
            {has(outfit, /Кепка|Панама/i) && (
              <mesh position={[0, -0.012, p.headR * 0.62]} rotation={[-0.12, 0, 0]}>
                <cylinderGeometry args={[p.headR * 1.5, p.headR * 1.5, 0.012, 24, 1, false, 0, Math.PI]} />
                <meshStandardMaterial color={palette.head} roughness={0.78} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        )}

        {/* ---------- очки ---------- */}
        {wearsGlasses && (
          <mesh position={[0, 0.72 + p.headR * 1.16, p.headR * 0.82]} scale={[1, 0.34, 0.5]}>
            <sphereGeometry args={[p.headR * 0.92, 20, 14]} />
            <meshStandardMaterial color="#111827" roughness={0.25} metalness={0.5} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/** Голова считается от макушки торса — используется зонтом и подписями. */
export const mannequinHeadY = (gender: Gender) => {
  const p = PROPS[gender];
  return -p.height * 0.78 + p.height * 0.52 * 0.94 + 0.72 + p.headR * 1.05;
};

export const mannequinReach = (gender: Gender) => PROPS[gender].shoulder * 1.3;
