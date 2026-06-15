import { useRef, useMemo } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';
import type { Room } from '../../types';
import { TOON_GRADIENT } from './ToonMaterial';

// Sims-style vibrant floor palettes
const FLOOR_PALETTES: Record<string, { floor: string; active: string; accent: string }> = {
  'living-room':    { floor: '#C8894A', active: '#E8A860', accent: '#A06830' },
  kitchen:          { floor: '#5AAAC0', active: '#7ACCDE', accent: '#3888A0' },
  'master-bedroom': { floor: '#A060C0', active: '#C080E0', accent: '#7840A0' },
  bathroom:         { floor: '#48B888', active: '#60D8A8', accent: '#309868' },
  office:           { floor: '#A8A830', active: '#C8C848', accent: '#808010' },
};

interface RoomMeshProps {
  room: Room;
  isActive: boolean;
  isHovered: boolean;
}

export function RoomMesh({ room, isActive, isHovered }: RoomMeshProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const floorRef   = useRef<THREE.MeshStandardMaterial>(null);

  const { setActiveRoom, setHoveredRoom, ui, placedObjects } = useAppStore();
  const { activeRoomId } = ui;

  const hw = room.width  / 2;
  const hd = room.depth  / 2;

  const palette = FLOOR_PALETTES[room.id] ?? { floor: room.floorColor, active: '#4a90d9', accent: '#888' };

  const onDevices = useMemo(
    () => placedObjects.filter(o => o.isAlexaDevice && o.parentRoomId === room.id && o.alexaDeviceState.isOn),
    [placedObjects, room.id]
  );
  const totalWatts = useMemo(
    () => onDevices.reduce((s, o) => s + (o.alexaDeviceState.powerConsumption ?? 0), 0),
    [onDevices]
  );

  // "Sink" targets: non-active rooms drop below floor when another room is active
  const hasOtherActive = !!activeRoomId && !isActive;
  const targetY  = hasOtherActive ? -0.5 : 0;
  // Floor opacity: dim non-active rooms; full for active or overview
  const targetOp = hasOtherActive ? 0.12 : 1.0;

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-0.012 * 60 * delta);
    if (groupRef.current) {
      groupRef.current.position.y += (targetY - groupRef.current.position.y) * t;
    }
    if (floorRef.current) {
      floorRef.current.opacity += (targetOp - floorRef.current.opacity) * t;
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

      {/* ── Room label (no emoji — troika-three-text doesn't render emoji) */}
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

      {/* ── Device activity badge — canvas-native Text, no Html ──────── */}
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
    </group>
  );
}
