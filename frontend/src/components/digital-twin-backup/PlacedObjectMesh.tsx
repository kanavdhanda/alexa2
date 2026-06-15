import { useRef, useEffect } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { Float, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';
import type { PlacedObject } from '../../types';
import { TOON_GRADIENT } from './ToonMaterial';
import {
  SofaGeometry, BedGeometry, TableGeometry, ChairGeometry,
  TVStandGeometry, BookshelfGeometry, BathtubGeometry, DeskGeometry,
  PlantGeometry, WardrobeGeometry,
  EchoDotGeometry, EchoShowGeometry, SmartBulbGeometry, ThermostatGeometry,
  SmartPlugGeometry, MotionSensorGeometry, SmartLockGeometry, CameraGeometry,
  SmokeDetectorGeometry, SmartTVGeometry, CeilingFanGeometry, DoorbellGeometry,
  AirPurifierGeometry, GeyserGeometry, WaterMotorGeometry, PressureCookerGeometry,
} from './FurnitureGeometry';

// ── Correct Y offsets so every object sits/mounts where it belongs ─────────────
export const HEIGHTS: Record<string, number> = {
  // Ceiling-mounted — cord/body originates from group origin, hangs DOWN from y=3
  'smart-bulb':     3.0,   // cord top at ceiling; bulb hangs to ~2.54
  'smoke-detector': 2.94,  // puck flush against ceiling
  'ceiling-fan':    2.7,   // drop-rod top just inside ceiling

  // Wall-mounted at correct ergonomic heights
  thermostat:       0.9,
  'smart-lock':     0.9,
  doorbell:         1.1,
  'motion-sensor':  1.2,

  // Tabletop / floor devices
  camera:           0,     // tabletop dome — was wrongly at 2.5
  'echo-dot':       0,
  'echo-show':      0,
  'smart-plug':     0,
  'smart-tv':       0.48,  // sits ON top of a tv-stand (stand top ≈ 0.48)
  'air-purifier':   0,

  // Indian context devices
  geyser:            0,    // floor-standing cylinder
  'water-motor':     0,    // floor-standing pump
  'pressure-cooker': 0.78, // on kitchen counter top

  // Furniture
  sofa: 0, bed: 0, table: 0, chair: 0, 'tv-stand': 0,
  bookshelf: 0, bathtub: 0, desk: 0, plant: 0, wardrobe: 0,
};

// Visual top-height used for the selection ring radius and label position
const TOP_H: Record<string, number> = {
  'smart-bulb': 0.36, 'echo-dot': 0.16, 'echo-show': 0.48, 'smart-plug': 0.14,
  'motion-sensor': 0.16, thermostat: 0.28, 'smart-lock': 0.26, camera: 0.22,
  'smoke-detector': 0.07, 'smart-tv': 1.0, 'ceiling-fan': 0.12,
  doorbell: 0.2, 'air-purifier': 0.65,
  geyser: 0.92, 'water-motor': 0.30, 'pressure-cooker': 0.28,
  sofa: 0.82, bed: 0.56, table: 0.82, chair: 0.95, 'tv-stand': 0.56,
  bookshelf: 1.85, bathtub: 0.55, desk: 0.98, plant: 0.72, wardrobe: 2.1,
};

// Floor-standing smart devices that get a subtle Float animation
const FLOAT_TYPES = new Set(['echo-dot', 'echo-show']);

// Footprint radii (metres) for floor objects — used for overlap detection + warning ring
export const FOOTPRINT_RADII: Record<string, number> = {
  sofa: 0.95, bed: 1.05, table: 0.55, chair: 0.25,
  'tv-stand': 0.8, bookshelf: 0.5, bathtub: 0.9,
  desk: 0.75, plant: 0.2, wardrobe: 0.65,
  'echo-dot': 0.15, 'echo-show': 0.26,
  'smart-plug': 0.07, 'smart-tv': 0.75,
  'air-purifier': 0.16, camera: 0.12,
  geyser: 0.22, 'water-motor': 0.22, 'pressure-cooker': 0.24,
};

// ── Sims-style diamond player marker for Alexa Echo devices ─────────────────
function AlexaPlayerMarker({ topH, isOn }: { topH: number; isOn: boolean }) {
  const markerRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!markerRef.current) return;
    // Gentle hover animation — marker bobs up and down
    markerRef.current.position.y = topH + 0.85 + Math.sin(state.clock.elapsedTime * 2.2) * 0.06;
  });

  const col = isOn ? '#00A8E0' : '#4A6A7A';
  const emissive = isOn ? '#0088CC' : '#1A2A3A';
  const emissiveInt = isOn ? 1.4 : 0.2;

  return (
    <group ref={markerRef} position={[0, topH + 0.85, 0]}>
      {/* Upper diamond half */}
      <mesh rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.115, 0.16, 4]} />
        <meshStandardMaterial color={col} emissive={emissive} emissiveIntensity={emissiveInt} roughness={0.2} metalness={0.4} />
      </mesh>
      {/* Lower diamond half (inverted cone = pointed bottom) */}
      <mesh rotation={[Math.PI, Math.PI / 4, 0]} position={[0, -0.085, 0]}>
        <coneGeometry args={[0.115, 0.14, 4]} />
        <meshStandardMaterial color={col} emissive={emissive} emissiveIntensity={emissiveInt} roughness={0.2} metalness={0.4} />
      </mesh>
      {/* "ALEXA" label below diamond */}
      <Text
        position={[0, -0.22, 0]}
        fontSize={0.095}
        color={isOn ? '#00C8FF' : '#5A8A9A'}
        anchorX="center"
        anchorY="middle"
        outlineColor="#00000099"
        outlineWidth={0.018}
        renderOrder={12}
      >
        ALEXA
      </Text>
    </group>
  );
}

// ── Device data label — shows the most important live reading for digital-twin feel
function DeviceDataLabel({ obj, topH }: { obj: PlacedObject; topH: number }) {
  const ds = obj.alexaDeviceState;
  let label = '';
  let color = '#00A8E0';

  if (obj.type === 'thermostat' && ds.temperature !== undefined) {
    label = `${ds.temperature}°C`;
    color = ds.temperature > 25 ? '#FF7043' : '#42A5F5';
  } else if (obj.type === 'air-purifier' && ds.airQuality !== undefined) {
    label = `AQI ${ds.airQuality}`;
    color = ds.airQuality > 150 ? '#EF5350' : ds.airQuality > 100 ? '#FFA726' : '#66BB6A';
  } else if (obj.type === 'smart-plug' && ds.powerConsumption !== undefined && ds.isOn) {
    label = `${ds.powerConsumption}W`;
    color = '#FFCA28';
  } else if (obj.type === 'motion-sensor') {
    if (!ds.motionDetected) return null;
    label = '◉ MOTION';
    color = '#EF5350';
  } else if (obj.type === 'geyser') {
    if (!ds.isOn) return null;
    label = ds.timerMinutes !== undefined ? `🔥 ${ds.timerMinutes}min` : '🔥 ON';
    color = '#FF7043';
  } else if (obj.type === 'water-motor') {
    const lvl = ds.waterLevel ?? 0;
    label = `💧 ${lvl}%`;
    color = lvl >= 90 ? '#66BB6A' : lvl < 30 ? '#EF5350' : '#42A5F5';
  } else if (obj.type === 'pressure-cooker') {
    if (!ds.isOn) return null;
    const w = ds.whistleCount ?? 0;
    label = w > 0 ? `🎵 ×${w}` : '♨ heating';
    color = '#FF9800';
  } else if (obj.type === 'camera' && ds.isOn) {
    label = '● LIVE';
    color = '#EF5350';
  } else {
    return null;
  }

  return (
    <Text
      position={[0, topH + 0.3, 0]}
      fontSize={0.14}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineColor="#00000099"
      outlineWidth={0.022}
      renderOrder={10}
    >
      {label}
    </Text>
  );
}

function DeviceGeometry({ obj }: { obj: PlacedObject }) {
  const ds = obj.alexaDeviceState;
  const isOn = ds.isOn;
  const col = obj.color ?? '#888';

  switch (obj.type) {
    case 'echo-dot':        return <EchoDotGeometry isOn={isOn} />;
    case 'echo-show':       return <EchoShowGeometry isOn={isOn} />;
    case 'smart-bulb':      return <SmartBulbGeometry isOn={isOn} color={col} />;
    case 'thermostat':      return <ThermostatGeometry isOn={isOn} />;
    case 'smart-plug':      return <SmartPlugGeometry isOn={isOn} />;
    case 'motion-sensor':   return <MotionSensorGeometry isOn={isOn} motionDetected={ds.motionDetected} />;
    case 'smart-lock':      return <SmartLockGeometry isOn={isOn} isLocked={ds.isLocked} />;
    case 'camera':          return <CameraGeometry isOn={isOn} />;
    case 'smoke-detector':  return <SmokeDetectorGeometry isOn={isOn} />;
    case 'smart-tv':        return <SmartTVGeometry isOn={isOn} />;
    case 'ceiling-fan':     return <CeilingFanGeometry isOn={isOn} speed={ds.speed} />;
    case 'doorbell':        return <DoorbellGeometry isOn={isOn} />;
    case 'air-purifier':    return <AirPurifierGeometry isOn={isOn} />;
    case 'geyser':          return <GeyserGeometry isOn={isOn} />;
    case 'water-motor':     return <WaterMotorGeometry isOn={isOn} />;
    case 'pressure-cooker': return <PressureCookerGeometry isOn={isOn} whistleCount={ds.whistleCount} />;
    case 'sofa':      return <SofaGeometry />;
    case 'bed':       return <BedGeometry />;
    case 'table':     return <TableGeometry />;
    case 'chair':     return <ChairGeometry />;
    case 'tv-stand':  return <TVStandGeometry />;
    case 'bookshelf': return <BookshelfGeometry />;
    case 'bathtub':   return <BathtubGeometry />;
    case 'desk':      return <DeskGeometry />;
    case 'plant':     return <PlantGeometry />;
    case 'wardrobe':  return <WardrobeGeometry />;
    default:
      return (
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.4, 0.5, 0.4]} />
          <meshToonMaterial color={col} gradientMap={TOON_GRADIENT} />
        </mesh>
      );
  }
}

interface PlacedObjectMeshProps {
  obj: PlacedObject;
  roomPosition?: { x: number; y: number; z: number };
  isOverlapping?: boolean;
}

export function PlacedObjectMesh({ obj, roomPosition, isOverlapping = false }: PlacedObjectMeshProps) {
  const groupRef   = useRef<THREE.Group>(null);
  const pulseRef   = useRef<THREE.Mesh>(null);
  const selectRef  = useRef<THREE.Mesh>(null);
  const scaleRef   = useRef(1);

  const { setSelectedObject, setHoveredObject, ui } = useAppStore();
  const { activeRoomId } = ui;

  const isSelected = ui.selectedObjectId === obj.id;
  const isHovered  = ui.hoveredObjectId  === obj.id;
  const isOn       = obj.alexaDeviceState.isOn;

  const yOffset = HEIGHTS[obj.type] ?? 0;
  const topH    = TOP_H[obj.type]   ?? 0.5;

  const localX = roomPosition ? obj.position.x - roomPosition.x : obj.position.x;
  const localZ = roomPosition ? obj.position.z - roomPosition.z : obj.position.z;

  const lastOpRef = useRef(1.0);

  const applyOpacity = (opacity: number) => {
    groupRef.current?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => { if (m) { m.transparent = true; m.opacity = opacity; } });
      }
    });
  };

  useEffect(() => {
    const op = activeRoomId ? (obj.parentRoomId === activeRoomId ? 0.90 : 0.05) : 1.0;
    lastOpRef.current = op;
    applyOpacity(op);
  }, [activeRoomId, obj.parentRoomId]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Opacity transitions (room zoom mode)
    const roomOp = activeRoomId ? (obj.parentRoomId === activeRoomId ? 0.90 : 0.05) : 1.0;
    if (Math.abs(lastOpRef.current - roomOp) > 0.01) {
      lastOpRef.current = roomOp;
      applyOpacity(roomOp);
    }

    // Smooth scale on hover
    const targetScale = isHovered ? 1.06 : 1.0;
    scaleRef.current += (targetScale - scaleRef.current) * 12 * delta;
    groupRef.current.scale.setScalar(scaleRef.current);

    // Active device pulse ring
    if (pulseRef.current && obj.isAlexaDevice && isOn) {
      const wave = Math.sin(performance.now() * 0.0045) * 0.5 + 0.5;
      pulseRef.current.scale.setScalar(1 + wave * 0.35);
      (pulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0.55 - wave * 0.45;
    }

    // Rotating gold selection ring
    if (selectRef.current && isSelected) {
      selectRef.current.rotation.z += delta * 1.2;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (ui.isPlacementMode) return;
    e.stopPropagation();
    setSelectedObject(isSelected ? null : obj.id);
  };

  const shouldFloat = FLOAT_TYPES.has(obj.type) && obj.isAlexaDevice && isOn;

  const innerContent = (
    <>
      <DeviceGeometry obj={obj} />

      {/* Live data label */}
      <DeviceDataLabel obj={obj} topH={topH} />

      {/* ── Alexa "Player Marker" (Sims-style overhead diamond) ─────────── */}
      {(obj.type === 'echo-dot' || obj.type === 'echo-show') && (
        <AlexaPlayerMarker topH={topH} isOn={isOn} />
      )}

      {/* Gold rotating selection ring */}
      {isSelected && (
        <mesh ref={selectRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(0.22, topH * 0.38), Math.max(0.28, topH * 0.46), 36]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.92} depthWrite={false} />
        </mesh>
      )}

      {/* Active device pulse ring (floor-standing only) */}
      {obj.isAlexaDevice && isOn && obj.type !== 'smart-bulb' && FOOTPRINT_RADII[obj.type] !== undefined && (
        <mesh ref={pulseRef} position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.22, 28]} />
          <meshBasicMaterial color={obj.color ?? '#00A8E0'} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}

      {/* Overlap warning ring — red floor ring when two objects intersect */}
      {isOverlapping && (
        <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            (FOOTPRINT_RADII[obj.type] ?? 0.3) * 0.85,
            (FOOTPRINT_RADII[obj.type] ?? 0.3) * 1.05,
            36,
          ]} />
          <meshBasicMaterial color="#FF2222" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
      {/* Overlap dashed wireframe box */}
      {isOverlapping && (
        <mesh position={[0, topH / 2, 0]}>
          <boxGeometry args={[
            (FOOTPRINT_RADII[obj.type] ?? 0.3) * 2,
            topH,
            (FOOTPRINT_RADII[obj.type] ?? 0.3) * 2,
          ]} />
          <meshBasicMaterial color="#FF4444" wireframe transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </>
  );

  return (
    <group
      ref={groupRef}
      position={[localX, obj.position.y + yOffset, localZ]}
      rotation={[0, obj.rotation.y, 0]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredObject(obj.id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHoveredObject(null);
        document.body.style.cursor = 'default';
      }}
    >
      {shouldFloat ? (
        <Float speed={1.8} floatIntensity={0.6} floatingRange={[-0.018, 0.018]} rotationIntensity={0}>
          {innerContent}
        </Float>
      ) : (
        innerContent
      )}
    </group>
  );
}
