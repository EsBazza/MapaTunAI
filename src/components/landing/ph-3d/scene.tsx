'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { formatCurrency } from '@/lib/format';
import { type Ph3dProvince, warningLevel, warningShare } from './data';

/*
 * A data graphic, not a light show: matte land, matte columns in the site's
 * risk colours, two plain lights. Column height = number of projects (sqrt
 * scale so small provinces stay visible); colour = share with warning signs.
 */

const LAND_DEPTH = 0.14;
const MAX_COLUMN = 3.2;
const MIN_COLUMN = 0.1;
const COLUMN_SIZE = 0.2; // square columns read as bars, like a printed chart
const LAND = '#012456'; // --color-navy-800
const LAND_ACTIVE = '#1556b5'; // --color-navy-500
const EDGE = '#ffffff';
/** Columns grow once, on first view. Short, ease-out, no overshoot. */
const RISE_SECONDS = 0.4;
const RISE_STAGGER = 0.006;

export interface SceneProps {
  provinces: Ph3dProvince[];
  /** Index into `provinces` that is highlighted (from the scene or the list beside it). */
  active: number | null;
  onActiveChange: (index: number | null) => void;
  onOpen: (index: number) => void;
  /** Render loop: run while visible, stop when off-screen. */
  running: boolean;
  reducedMotion: boolean;
  coarsePointer: boolean;
}

function columnHeight(count: number, maxCount: number) {
  if (count <= 0) return 0;
  return MIN_COLUMN + (MAX_COLUMN - MIN_COLUMN) * Math.sqrt(count / maxCount);
}

interface PickHandlers {
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
}

function ProvinceLand({ province, index, isActive, onHover, onSelect }: { province: Ph3dProvince; index: number; isActive: boolean } & PickHandlers) {
  const geometry = useMemo(() => {
    const shapes = province.shapes.map((flat) => {
      const shape = new THREE.Shape();
      shape.moveTo(flat[0], flat[1]);
      for (let i = 2; i < flat.length; i += 2) shape.lineTo(flat[i], flat[i + 1]);
      shape.closePath();
      return shape;
    });
    return new THREE.ExtrudeGeometry(shapes, { depth: LAND_DEPTH, bevelEnabled: false });
  }, [province.shapes]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(index);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(index);
      }}
    >
      <meshStandardMaterial color={isActive ? LAND_ACTIVE : LAND} roughness={0.95} metalness={0} />
      <Edges threshold={20} color={EDGE} transparent opacity={isActive ? 0.55 : 0.14} />
    </mesh>
  );
}

function Column({
  province,
  index,
  rank,
  maxCount,
  isActive,
  animate,
  onHover,
  onSelect,
}: {
  province: Ph3dProvince;
  index: number;
  rank: number;
  maxCount: number;
  isActive: boolean;
  animate: boolean;
} & PickHandlers) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(animate ? 0 : 1);
  const height = columnHeight(province.count, maxCount);
  const color = warningLevel(warningShare(province)).color;

  useFrame((state) => {
    const g = group.current;
    if (!g || progress.current >= 1) return;
    const t = Math.max(0, state.clock.elapsedTime - rank * RISE_STAGGER) / RISE_SECONDS;
    // ease-out cubic: fast start, gentle settle
    progress.current = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
    g.scale.y = Math.max(progress.current, 0.0001);
  });

  if (height <= 0) return null;

  return (
    <group position={[province.anchor[0], LAND_DEPTH, -province.anchor[1]]}>
      <group ref={group} scale={[1, animate ? 0.0001 : 1, 1]}>
        <mesh
          position={[0, height / 2, 0]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(index);
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(index);
          }}
        >
          <boxGeometry args={[COLUMN_SIZE, height, COLUMN_SIZE]} />
          <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
          {isActive && <Edges color={EDGE} transparent opacity={0.9} />}
        </mesh>
      </group>

      {isActive && (
        <Html position={[0, height + 0.3, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <Tooltip province={province} />
        </Html>
      )}
    </group>
  );
}

function Tooltip({ province }: { province: Ph3dProvince }) {
  const share = warningShare(province);
  return (
    <div className="w-56 -translate-y-1/2 rounded-xl border border-white/15 bg-navy-950 px-3.5 py-3 text-left text-white shadow-lg">
      <p className="text-sm font-semibold leading-snug">{province.name}</p>
      {province.region && <p className="mt-0.5 text-xs text-white/60">{province.region}</p>}
      <dl className="mt-2.5 space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">Projects</dt>
          <dd className="font-semibold tabular-nums">{province.count.toLocaleString('en-PH')}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">Budget</dt>
          <dd className="font-semibold tabular-nums">{formatCurrency(province.budgetPHP)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/65">With warning signs</dt>
          <dd className="font-semibold tabular-nums">{(share * 100).toFixed(1)}%</dd>
        </div>
      </dl>
    </div>
  );
}

export default function PhilippinesScene({
  provinces,
  active,
  onActiveChange,
  onOpen,
  running,
  reducedMotion,
  coarsePointer,
}: SceneProps) {
  const maxCount = useMemo(() => Math.max(1, ...provinces.map((p) => p.count)), [provinces]);
  // The slow turn stops for good the first time someone takes control.
  const [userTookOver, setUserTookOver] = useState(false);
  const ranks = useMemo(() => {
    const order = provinces.map((p, i) => ({ i, c: p.count })).sort((a, b) => b.c - a.c);
    const r = new Array<number>(provinces.length);
    order.forEach((o, rank) => (r[o.i] = rank));
    return r;
  }, [provinces]);

  const onHover = coarsePointer ? () => undefined : onActiveChange;
  const onSelect = (index: number) => {
    setUserTookOver(true);
    // Touch: first tap shows the details, a second tap on the same province opens it.
    if (coarsePointer && active !== index) {
      onActiveChange(index);
      return;
    }
    onOpen(index);
  };

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={running ? (reducedMotion ? 'demand' : 'always') : 'never'}
      camera={{ position: [0, 15, 13.5], fov: 36, near: 0.1, far: 200 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onActiveChange(null)}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 12, 7]} intensity={1.1} />

      <group rotation={[-Math.PI / 2, 0, 0]}>
        {provinces.map((p, i) => (
          <ProvinceLand key={p.name} province={p} index={i} isActive={active === i} onHover={onHover} onSelect={onSelect} />
        ))}
      </group>

      {provinces.map((p, i) => (
        <Column
          key={p.name}
          province={p}
          index={i}
          rank={ranks[i]}
          maxCount={maxCount}
          isActive={active === i}
          animate={!reducedMotion}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        makeDefault
        target={[0, 0.6, 0]}
        enablePan={false}
        enableZoom={false}
        enableRotate={!coarsePointer}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.35}
        maxPolarAngle={1.15}
        autoRotate={!reducedMotion && !userTookOver && active === null}
        autoRotateSpeed={0.35}
        onStart={() => setUserTookOver(true)}
      />
    </Canvas>
  );
}
