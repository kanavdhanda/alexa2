import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LAYOUT_NODES, WALL_SEGMENTS } from '../../constants/layout';
import { useAppStore } from '../../store/store';
const WALL_T = 0.14;
const WALL_COLOR = '#EDE8DC';  // warm off-white plaster
const POST_COLOR = '#D8D0C0';  // corner post, slightly darker

// ── Single animated wall segment ─────────────────────────────────────────────

interface WallMeshProps {
  fromX: number; fromZ: number;
  toX: number;   toZ: number;
  height: number;
  sharedBy: string[];
  activeRoomId: string | null;
}

function WallMesh({ fromX, fromZ, toX, toZ, height, sharedBy, activeRoomId }: WallMeshProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle  = Math.atan2(dz, dx);
  const midX   = (fromX + toX) / 2;
  const midZ   = (fromZ + toZ) / 2;

  // Target opacity: exterior walls are nearly solid, interior walls slightly lighter,
  // walls not touching the active room ghost out.
  const isExterior  = sharedBy.length === 1;
  const isRelevant  = !activeRoomId || sharedBy.includes(activeRoomId);
  const targetOp    = !activeRoomId
    ? (isExterior ? 0.92 : 0.78)
    : isRelevant  ? 0.90 : 0.05;

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const t = 1 - Math.exp(-0.013 * 60 * delta);
    matRef.current.opacity += (targetOp - matRef.current.opacity) * t;
  });

  return (
    <mesh
      position={[midX, height / 2, midZ]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      {/* +WALL_T on length so segments overlap at corners, no gaps */}
      <boxGeometry args={[length + WALL_T, height, WALL_T]} />
      <meshStandardMaterial
        ref={matRef}
        color={WALL_COLOR}
        roughness={0.85}
        metalness={0.0}
        transparent
        opacity={targetOp}
      />
    </mesh>
  );
}

// ── Corner post at each node ──────────────────────────────────────────────────

interface PostProps {
  x: number; z: number; height: number; activeRoomId: string | null;
  adjacentRooms: string[];
}

function CornerPost({ x, z, height, activeRoomId, adjacentRooms }: PostProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const isRelevant = !activeRoomId || adjacentRooms.includes(activeRoomId);
  const targetOp   = !activeRoomId ? 0.95 : isRelevant ? 0.95 : 0.05;

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const t = 1 - Math.exp(-0.013 * 60 * delta);
    matRef.current.opacity += (targetOp - matRef.current.opacity) * t;
  });

  return (
    <mesh position={[x, height / 2, z]} castShadow>
      <boxGeometry args={[WALL_T * 1.6, height, WALL_T * 1.6]} />
      <meshStandardMaterial
        ref={matRef}
        color={POST_COLOR}
        roughness={0.85}
        metalness={0.0}
        transparent
        opacity={targetOp}
      />
    </mesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConnectedWalls() {
  const { ui } = useAppStore();
  const { activeRoomId } = ui;

  // Build a map from nodeId → all rooms that touch it (for post opacity)
  const nodeRooms: Record<string, Set<string>> = {};
  for (const seg of WALL_SEGMENTS) {
    for (const nId of [seg.fromId, seg.toId]) {
      if (!nodeRooms[nId]) nodeRooms[nId] = new Set();
      seg.sharedBy.forEach(r => nodeRooms[nId].add(r));
    }
  }

  return (
    <group>
      {/* Wall segments */}
      {WALL_SEGMENTS.map(seg => {
        const from = LAYOUT_NODES[seg.fromId];
        const to   = LAYOUT_NODES[seg.toId];
        return (
          <WallMesh
            key={seg.id}
            fromX={from.x} fromZ={from.z}
            toX={to.x}     toZ={to.z}
            height={seg.height}
            sharedBy={seg.sharedBy}
            activeRoomId={activeRoomId}
          />
        );
      })}

      {/* Corner posts — one per unique node */}
      {Object.values(LAYOUT_NODES).map(node => (
        <CornerPost
          key={node.id}
          x={node.x} z={node.z}
          height={3}
          activeRoomId={activeRoomId}
          adjacentRooms={Array.from(nodeRooms[node.id] ?? [])}
        />
      ))}
    </group>
  );
}
