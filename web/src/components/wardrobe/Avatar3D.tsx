import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import GlobeCanvas, { useDragReporter } from '../GlobeCanvas';
import type { Outfit } from '../../lib/outfit';

/**
 * 3D-аватар «Одеватора».
 *
 * Готовых rigged-моделей в проекте нет и тянуть их со стороны некуда, поэтому
 * фигура собирается процедурно из примитивов. Это честный компромисс: силуэт
 * читается, одежда меняет цвет и состав по погоде, а вес сцены — считаные
 * килобайты вместо мегабайтного GLB.
 */

export type Gender = 'male' | 'female';

const SKIN = '#e8b48c';
const HAIR: Record<Gender, string> = { male: '#3a2b23', female: '#6b3f2a' };

interface PartProps {
  outfit: Outfit;
  gender: Gender;
}

/** Есть ли в наборе вещь, чьё название совпало с образцом. */
const has = (outfit: Outfit, re: RegExp) => outfit.items.some((i) => re.test(i.label));

function Body({ outfit, gender }: PartProps) {
  const female = gender === 'female';
  const { palette } = outfit;

  // женская фигура чуть ниже и уже в плечах — силуэт различим с одного взгляда
  const shoulder = female ? 0.42 : 0.52;
  const hip = female ? 0.46 : 0.44;
  const torsoTop = female ? 1.3 : 1.36;
  const headY = female ? 1.5 : 1.56;
  const headR = female ? 0.2 : 0.21;

  const wearsHat = !!palette.head && has(outfit, /Шапка|Кепка|Панама|Капюшон|балаклава/i);
  const wearsScarf = has(outfit, /Шарф/i);
  const wearsGlasses = has(outfit, /очки/i);
  const wearsGloves = has(outfit, /Перчатки|Варежки/i);

  return (
    <group position={[0, -0.85, 0]}>
      {/* ---- ноги ---- */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.13, 0.38, 0]}>
          <cylinderGeometry args={[0.085, 0.075, 0.76, 12]} />
          <meshStandardMaterial color={palette.legs} roughness={0.85} />
        </mesh>
      ))}

      {/* ---- обувь ---- */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.13, 0.045, 0.045]}>
          <boxGeometry args={[0.19, 0.09, 0.3]} />
          <meshStandardMaterial color={palette.shoes} roughness={0.6} />
        </mesh>
      ))}

      {/* ---- корпус: верхняя одежда ---- */}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[shoulder / 2, hip / 2, 0.62, 16]} />
        <meshStandardMaterial color={palette.outer} roughness={0.75} />
      </mesh>

      {/* воротник / плечи */}
      <mesh position={[0, torsoTop, 0]}>
        <sphereGeometry args={[shoulder / 2, 16, 12]} />
        <meshStandardMaterial color={palette.outer} roughness={0.75} />
      </mesh>

      {/* ---- руки ---- */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (shoulder / 2 + 0.06), 1.08, 0]} rotation={[0, 0, side * 0.14]}>
          <mesh>
            <cylinderGeometry args={[0.06, 0.055, 0.58, 10]} />
            <meshStandardMaterial color={palette.outer} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <sphereGeometry args={[0.062, 12, 10]} />
            <meshStandardMaterial color={wearsGloves ? palette.head ?? '#3f3f46' : SKIN} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ---- шея и голова ---- */}
      <mesh position={[0, torsoTop + 0.08, 0]}>
        <cylinderGeometry args={[0.075, 0.08, 0.1, 10]} />
        <meshStandardMaterial color={SKIN} roughness={0.9} />
      </mesh>
      <mesh position={[0, headY, 0]}>
        <sphereGeometry args={[headR, 20, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.9} />
      </mesh>

      {/* ---- волосы ---- */}
      {female ? (
        <>
          <mesh position={[0, headY + 0.03, -0.01]}>
            <sphereGeometry args={[headR + 0.035, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color={HAIR.female} roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          {/* каре по бокам */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (headR - 0.01), headY - 0.09, -0.02]}>
              <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
              <meshStandardMaterial color={HAIR.female} roughness={0.95} />
            </mesh>
          ))}
        </>
      ) : (
        <mesh position={[0, headY + 0.05, -0.005]}>
          <sphereGeometry args={[headR + 0.02, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={HAIR.male} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* ---- головной убор ---- */}
      {wearsHat && palette.head && (
        <group position={[0, headY + 0.13, 0]}>
          <mesh>
            <sphereGeometry args={[headR + 0.045, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={palette.head} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          {has(outfit, /Кепка|Панама/i) && (
            <mesh position={[0, -0.02, headR * 0.7]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[headR + 0.11, headR + 0.11, 0.02, 20, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color={palette.head} roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      )}

      {/* ---- шарф ---- */}
      {wearsScarf && (
        <mesh position={[0, torsoTop + 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.038, 10, 20]} />
          <meshStandardMaterial color="#dc2626" roughness={0.95} />
        </mesh>
      )}

      {/* ---- очки ---- */}
      {wearsGlasses && (
        <mesh position={[0, headY + 0.03, headR - 0.01]}>
          <boxGeometry args={[headR * 1.7, 0.055, 0.05]} />
          <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.4} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Зонт в руке, если алгоритм его назначил.
 *
 * Точка отсчёта — кисть фигуры (Body сдвинут на -0.85 по Y), поэтому купол
 * поднят так, чтобы оказаться над головой, а не на уровне лица.
 */
function Umbrella({ gender }: { gender: Gender }) {
  const x = gender === 'female' ? 0.36 : 0.4;
  return (
    <group position={[x, -0.11, 0.14]} rotation={[0, 0, -0.16]}>
      {/* трость от кисти вверх */}
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.04, 8]} />
        <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* купол */}
      <mesh position={[0, 1.08, 0]}>
        <coneGeometry args={[0.36, 0.2, 24, 1, true]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* навершие */}
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
    </group>
  );
}

function Scene({ genders, outfit }: { genders: Gender[]; outfit: Outfit }) {
  const reportDrag = useDragReporter();
  const withUmbrella = has(outfit, /Зонт/i);
  // паре нужен реальный зазор, иначе фигуры перекрывают друг друга
  const spread = genders.length > 1 ? 1.15 : 0;

  return (
    <>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={false}
        autoRotate={false}
        enableDamping
        dampingFactor={0.09}
        rotateSpeed={0.6}
        // фигуру крутим только вокруг вертикали: сверху и снизу смотреть не на что
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 1.85}
        onStart={() => reportDrag(true)}
        onEnd={() => reportDrag(false)}
      />

      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} />
      <directionalLight position={[-3, 2, -3]} intensity={0.7} color="#8b5cf6" />

      {genders.map((g, i) => (
        <group key={g} position={[(i - (genders.length - 1) / 2) * spread, 0, 0]}>
          <Body outfit={outfit} gender={g} />
          {withUmbrella && i === genders.length - 1 && <Umbrella gender={g} />}
        </group>
      ))}

      {/* подставка, чтобы фигуры не висели в пустоте */}
      <mesh position={[0, -0.88, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[genders.length > 1 ? 1.5 : 0.62, 32]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0.55} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function Avatar3D({
  outfit,
  gender,
  className = '',
}: {
  outfit: Outfit;
  /**
   * Пол из профиля. null — пользователь не вошёл или не указал пол:
   * по ТЗ показываем обе фигуры рядом.
   */
  gender: Gender | null;
  className?: string;
}) {
  const genders = useMemo<Gender[]>(
    () => (gender ? [gender] : ['male', 'female']),
    [gender]
  );

  // пара фигур не влезает в тот же кадр, что и одна — отодвигаем камеру
  const camera = useMemo(
    () => ({ position: [0, 0.05, genders.length > 1 ? 4.4 : 2.9] as [number, number, number], fov: 40 }),
    [genders.length]
  );

  return (
    <GlobeCanvas
      className={className}
      camera={camera}
      onDemand
      dprMax={1.5}
      // подсказка перекрывала бы ноги фигур: у сцены и так курсор-хват
      hint={false}
    >
      <Scene genders={genders} outfit={outfit} />
    </GlobeCanvas>
  );
}
