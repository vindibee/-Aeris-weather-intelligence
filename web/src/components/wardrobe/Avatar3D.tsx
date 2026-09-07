import { useMemo } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import GlobeCanvas, { useDragReporter } from '../GlobeCanvas';
import type { Outfit } from '../../lib/outfit';
import Mannequin, { mannequinHeadY, mannequinReach, type Gender } from './Mannequin';

/**
 * 3D-аватар «Одеватора».
 *
 * Сцена и управление камерой. Сама фигура живёт в [Mannequin] — так сцена не
 * знает, из чего собрано тело, и его можно заменить хоть на .glb-модель,
 * ничего здесь не трогая.
 */

export type { Gender };

/** Есть ли в наборе вещь, чьё название совпало с образцом. */
const has = (outfit: Outfit, re: RegExp) => outfit.items.some((i) => re.test(i.label));

/**
 * Зонт в руке, если алгоритм его назначил.
 *
 * Точка отсчёта — кисть фигуры (Body сдвинут на -0.85 по Y), поэтому купол
 * поднят так, чтобы оказаться над головой, а не на уровне лица.
 */
function Umbrella({ gender }: { gender: Gender }) {
  // размеры берём у манекена, чтобы зонт не разъезжался с фигурой
  const headY = mannequinHeadY(gender);
  const x = mannequinReach(gender);
  return (
    <group position={[x, headY - 0.58, 0.1]} rotation={[0, 0, -0.14]}>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.58, 8]} />
        <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <coneGeometry args={[0.28, 0.16, 26, 1, true]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.71, 0]}>
        <sphereGeometry args={[0.016, 8, 8]} />
        <meshStandardMaterial color="#0ea5e9" />
      </mesh>
    </group>
  );
}

function Scene({ genders, outfit }: { genders: Gender[]; outfit: Outfit }) {
  const reportDrag = useDragReporter();
  const withUmbrella = has(outfit, /Зонт/i);
  // паре нужен реальный зазор, иначе фигуры перекрывают друг друга
  const spread = genders.length > 1 ? 0.78 : 0;

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
          <Mannequin outfit={outfit} gender={g} />
          {withUmbrella && i === genders.length - 1 && <Umbrella gender={g} />}
        </group>
      ))}

      {/* подставка, чтобы фигуры не висели в пустоте */}
      <mesh position={[0, -0.79, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[genders.length > 1 ? 1.05 : 0.46, 40]} />
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
    () => ({ position: [0, 0.02, genders.length > 1 ? 3.1 : 2.2] as [number, number, number], fov: 40 }),
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
