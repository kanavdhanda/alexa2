import { useRef, useMemo, useEffect } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { Text, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';
import type { Room } from '../../types';
import { PlacedObjectMesh, FOOTPRINT_RADII } from './PlacedObjectMesh';
import {
  LivingRoomDecor,
  KitchenDecor,
  BathroomDecor,
  BedroomDecor,
  OfficeDecor,
  MandiDecor,
} from './HouseDecor';

// Floor palettes
const FLOOR_PALETTES: Record<string, { floor: string; active: string; accent: string }> = {
  'living-room':    { floor: '#F3EFEB', active: '#EADFD7', accent: '#DDD5CD' },
  kitchen:          { floor: '#EAEFF2', active: '#DCE5EC', accent: '#CED8E0' },
  'master-bedroom': { floor: '#F5ECE1', active: '#EBDEC9', accent: '#DDD0BA' },
  bathroom:         { floor: '#E8F5F1', active: '#D6ECE5', accent: '#C4E2D8' },
  office:           { floor: '#FAF3E8', active: '#EFE2CC', accent: '#E3D2B5' },
  mandir:           { floor: '#FDE8C0', active: '#F8D080', accent: '#F0C060' },
};

// Compute which floor objects in a room overlap each other (circle-circle XZ test)
function computeOverlappingIds(objects: ReturnType<typeof useAppStore.getState>['placedObjects']): Set<string> {
  const result = new Set<string>();
  const floor = objects.filter(o => FOOTPRINT_RADII[o.type] !== undefined);
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      const a = floor[i], b = floor[j];
      const dx = a.position.x - b.position.x;
      const dz = a.position.z - b.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = (FOOTPRINT_RADII[a.type] ?? 0.3) + (FOOTPRINT_RADII[b.type] ?? 0.3);
      if (dist < minDist * 0.82) {
        result.add(a.id);
        result.add(b.id);
      }
    }
  }
  return result;
}

// Kelvin → rough hex for sparkle color matching
function kelvinToSparkleColor(k: number): string {
  if (k < 3000) return '#FFD080';
  if (k < 4500) return '#FFE8B0';
  return '#D0E8FF';
}

interface RoomMeshProps {
  room: Room;
  isActive: boolean;
  isHovered: boolean;
}

export function RoomMesh({ room, isActive, isHovered }: RoomMeshProps) {
  const groupRef  = useRef<THREE.Group>(null);
  const floorRef  = useRef<THREE.MeshStandardMaterial>(null);

  const { setActiveRoom, setHoveredRoom, ui, placedObjects, updatePlacedObject } = useAppStore();
  const { activeRoomId } = ui;

  const hw = room.width  / 2;
  const hd = room.depth  / 2;

  const palette = FLOOR_PALETTES[room.id] ?? { floor: room.floorColor, active: '#4a90d9', accent: '#888' };

  const roomObjects = useMemo(
    () => placedObjects.filter(o => o.parentRoomId === room.id),
    [placedObjects, room.id]
  );

  const onDevices = useMemo(
    () => roomObjects.filter(o => o.isAlexaDevice && o.alexaDeviceState.isOn),
    [roomObjects]
  );

  // Auto-start pressure cooker when kitchen is focused (digital twin context awareness)
  useEffect(() => {
    if (room.id === 'kitchen' && isActive) {
      const cooker = roomObjects.find(o => o.type === 'pressure-cooker');
      if (cooker && !cooker.alexaDeviceState.isOn) {
        updatePlacedObject(cooker.id, {
          alexaDeviceState: { ...cooker.alexaDeviceState, isOn: true, pressure: 5, whistleCount: 0 },
        });
      }
    }
  }, [isActive, room.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalWatts = useMemo(
    () => onDevices.reduce((s, o) => s + (o.alexaDeviceState.powerConsumption ?? 0), 0),
    [onDevices]
  );

  // Overlap detection for all placed objects globally (same room only really matters)
  const overlappingIds = useMemo(() => computeOverlappingIds(roomObjects), [roomObjects]);

  // Active smart bulbs in this room for Sparkles effect
  const activeBulbs = useMemo(
    () => roomObjects.filter(o => o.type === 'smart-bulb' && o.alexaDeviceState.isOn),
    [roomObjects]
  );
  const sparkleColor = activeBulbs.length > 0
    ? kelvinToSparkleColor(activeBulbs[0].alexaDeviceState.colorTemp ?? 3000)
    : '#C0D8FF';

  const hasOtherActive = !!activeRoomId && !isActive;
  const targetY  = hasOtherActive ? -0.5 : 0;
  const targetOp = hasOtherActive ? 0.12 : 1.0;

  useEffect(() => {
    const op = hasOtherActive ? 0.12 : 1.0;
    if (floorRef.current) floorRef.current.opacity = op;
    groupRef.current?.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material !== floorRef.current) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => { if (m && m.type !== 'MeshBasicMaterial') { m.transparent = true; m.opacity = op; } });
      }
    });
  }, [activeRoomId, isActive, hasOtherActive]);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-0.012 * 60 * delta);
    if (groupRef.current) {
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * t;
    }
    if (floorRef.current) {
      const isTransitioning = Math.abs(floorRef.current.opacity - targetOp) > 0.005;
      if (isTransitioning) {
        const op = floorRef.current.opacity + (targetOp - floorRef.current.opacity) * t;
        floorRef.current.opacity = op;
        groupRef.current?.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material !== floorRef.current) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => { if (m && m.type !== 'MeshBasicMaterial') { m.transparent = true; m.opacity = op; } });
          }
        });
      }
    }
  });

  const floorColor = isActive ? palette.active : isHovered ? palette.accent : palette.floor;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (ui.isPlacementMode) return;
    e.stopPropagation();
    setActiveRoom(isActive ? null : room.id);
  };
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredRoom(room.id);
    document.body.style.cursor = 'pointer';
  };
  const handleOut = () => {
    setHoveredRoom(null);
    document.body.style.cursor = 'default';
  };

  return (
    <group ref={groupRef} position={[room.position.x, room.position.y, room.position.z]}>

      {/* ── Floor ──────────────────────────────────────────────────────── */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={handleClick}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <planeGeometry args={[room.width, room.depth]} />
        <meshStandardMaterial
          ref={floorRef}
          color={floorColor}
          roughness={0.72}
          metalness={0.02}
          transparent
          opacity={1}
        />
      </mesh>

      {/* Active glow ring */}
      {isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[Math.min(hw, hd) * 0.42, Math.min(hw, hd) * 0.55, 48]} />
          <meshBasicMaterial color="#00C8FF" transparent opacity={0.35} />
        </mesh>
      )}

      {/* Hover highlight */}
      {isHovered && !isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[room.width, room.depth]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.07} />
        </mesh>
      )}

      {/* ── Room label */}
      <Text
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={isActive ? 0.52 : 0.42}
        color={isActive ? '#ffffff' : isHovered ? '#ffffff' : '#ffffffcc'}
        anchorX="center"
        anchorY="middle"
        maxWidth={room.width - 1}
        outlineColor="#00000088"
        outlineWidth={0.03}
        letterSpacing={0.04}
      >
        {room.name.toUpperCase()}
      </Text>

      {/* ── Device activity badge */}
      {onDevices.length > 0 && !isActive && (
        <Text
          position={[hw - 1.4, 0.06, -hd + 0.9]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.17}
          color="#22DD66"
          anchorX="center"
          anchorY="middle"
          outlineColor="#000000CC"
          outlineWidth={0.018}
        >
          {`${onDevices.length} ON  ${totalWatts.toFixed(0)}W`}
        </Text>
      )}

      {/* ── Ambient sparkles when smart bulbs are active — digital twin "data presence" */}
      {activeBulbs.length > 0 && (
        <Sparkles
          count={isActive ? 40 : 18}
          scale={[room.width * 0.75, 2.2, room.depth * 0.75]}
          position={[0, 1.4, 0]}
          size={isActive ? 2.5 : 1.8}
          speed={0.18}
          opacity={isActive ? 0.55 : 0.28}
          color={sparkleColor}
          noise={0.4}
        />
      )}

      {/* Subtle darkness when no smart bulbs are on — lights-off digital twin effect */}
      {activeBulbs.length === 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
          <planeGeometry args={[room.width - 0.1, room.depth - 0.1]} />
          <meshBasicMaterial color="#000820" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}

      {/* ── Room Specific Decor (Static/Click-Through) ────────────────── */}
      <group raycast={() => null}>
        {room.id === 'living-room'    && <LivingRoomDecor />}
        {room.id === 'kitchen'        && <KitchenDecor />}
        {room.id === 'bathroom'       && <BathroomDecor />}
        {room.id === 'master-bedroom' && <BedroomDecor />}
        {room.id === 'office'         && <OfficeDecor />}
        {room.id === 'mandir'         && <MandiDecor />}
      </group>

      {/* ── Placed Objects (Interactive) ───────────────────────────────── */}
      {roomObjects.map((obj) => (
        <PlacedObjectMesh
          key={obj.id}
          obj={obj}
          roomPosition={room.position}
          isOverlapping={overlappingIds.has(obj.id)}
        />
      ))}
    </group>
  );
}
