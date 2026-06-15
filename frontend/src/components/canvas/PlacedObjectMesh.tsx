import { useRef } from 'react';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';
import type { PlacedObject } from '../../types';
import { TOON_GRADIENT } from './ToonMaterial';
import { draggingObjectIdRef } from './dragRef';
import {
  SofaGeometry, BedGeometry, TableGeometry, ChairGeometry,
  TVStandGeometry, BookshelfGeometry, BathtubGeometry, DeskGeometry,
  PlantGeometry, WardrobeGeometry,
  EchoDotGeometry, EchoShowGeometry, SmartBulbGeometry, ThermostatGeometry,
  SmartPlugGeometry, MotionSensorGeometry, SmartLockGeometry, CameraGeometry,
  SmokeDetectorGeometry, SmartTVGeometry, CeilingFanGeometry, DoorbellGeometry,
  AirPurifierGeometry,
} from './FurnitureGeometry';

// Y offset so each object type sits at the correct height in the 3-unit wall space
const HEIGHTS: Record<string, number> = {
  // Ceiling-mounted — hang from the 3-unit ceiling
  'smart-bulb':     2.7,
  'smoke-detector': 2.85,
  'ceiling-fan':    2.7,
  camera:           2.5,
  // Wall-mounted at mid height
  thermostat:       0.9,
  'smart-lock':     0.9,
  doorbell:         1.1,
  'motion-sensor':  1.2,
  // Floor-level
  'echo-dot': 0, 'echo-show': 0, 'smart-plug': 0, 'smart-tv': 0,
  'air-purifier': 0,
  sofa: 0, bed: 0, table: 0, chair: 0, 'tv-stand': 0,
  bookshelf: 0, bathtub: 0, desk: 0, plant: 0, wardrobe: 0,
};

// Visual top-height used for the selection ring radius
const TOP_H: Record<string, number> = {
  'smart-bulb': 0.36, 'echo-dot': 0.14, 'echo-show': 0.45, 'smart-plug': 0.16,
  'motion-sensor': 0.18, 'thermostat': 0.28, 'smart-lock': 0.24, camera: 0.18,
  'smoke-detector': 0.1, 'smart-tv': 1.0, 'ceiling-fan': 0.12,
  doorbell: 0.2, 'air-purifier': 0.65,
  sofa: 0.82, bed: 0.56, table: 0.82, chair: 0.95, 'tv-stand': 0.56,
  bookshelf: 1.85, bathtub: 0.55, desk: 0.98, plant: 0.72, wardrobe: 2.1,
};

function DeviceGeometry({ obj }: { obj: PlacedObject }) {
  const ds = obj.alexaDeviceState;
  const isOn = ds.isOn;
  const col = obj.color ?? '#888';

  switch (obj.type) {
    case 'echo-dot':       return <EchoDotGeometry isOn={isOn} />;
    case 'echo-show':      return <EchoShowGeometry isOn={isOn} />;
    case 'smart-bulb':     return <SmartBulbGeometry isOn={isOn} color={col} />;
    case 'thermostat':     return <ThermostatGeometry isOn={isOn} />;
    case 'smart-plug':     return <SmartPlugGeometry isOn={isOn} />;
    case 'motion-sensor':  return <MotionSensorGeometry isOn={isOn} motionDetected={ds.motionDetected} />;
    case 'smart-lock':     return <SmartLockGeometry isOn={isOn} isLocked={ds.isLocked} />;
    case 'camera':         return <CameraGeometry isOn={isOn} />;
    case 'smoke-detector': return <SmokeDetectorGeometry isOn={isOn} />;
    case 'smart-tv':       return <SmartTVGeometry isOn={isOn} />;
    case 'ceiling-fan':    return <CeilingFanGeometry isOn={isOn} speed={ds.speed} />;
    case 'doorbell':       return <DoorbellGeometry isOn={isOn} />;
    case 'air-purifier':   return <AirPurifierGeometry isOn={isOn} />;
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

export function PlacedObjectMesh({ obj }: { obj: PlacedObject }) {
  const groupRef = useRef<THREE.Group>(null);
  const { setSelectedObject, setHoveredObject, ui } = useAppStore();
  const isSelected = ui.selectedObjectId === obj.id;
  const isOn = obj.alexaDeviceState.isOn;
  const yOffset = HEIGHTS[obj.type] ?? 0;
  const topH = TOP_H[obj.type] ?? 0.5;
  const isEditMode = ui.isLayoutEditMode && !ui.layoutLocked;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (!isEditMode && obj.isAlexaDevice && isOn && obj.type !== 'ceiling-fan') {
      groupRef.current.position.y = obj.position.y + yOffset + Math.sin(clock.getElapsedTime() * 1.4 + obj.position.x * 0.8) * 0.015;
    } else {
      groupRef.current.position.y = obj.position.y + yOffset;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (ui.isPlacementMode || isEditMode) return;
    e.stopPropagation();
    setSelectedObject(isSelected ? null : obj.id);
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isEditMode) return;
    e.stopPropagation();
    draggingObjectIdRef.current = obj.id;
  };

  return (
    <group
      ref={groupRef}
      position={[obj.position.x, obj.position.y + yOffset, obj.position.z]}
      rotation={[0, obj.rotation.y, 0]}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHoveredObject(obj.id);
        document.body.style.cursor = isEditMode ? 'grab' : 'pointer';
      }}
      onPointerOut={() => {
        setHoveredObject(null);
        document.body.style.cursor = 'default';
      }}
    >
      <DeviceGeometry obj={obj} />

      {/* Gold selection ring — no Html, no z-index issues */}
      {isSelected && !isEditMode && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            Math.max(0.22, topH * 0.38),
            Math.max(0.28, topH * 0.46),
            36,
          ]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.92} depthWrite={false} />
        </mesh>
      )}

      {/* Edit mode drag ring */}
      {isEditMode && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            Math.max(0.22, topH * 0.38),
            Math.max(0.28, topH * 0.46),
            36,
          ]} />
          <meshBasicMaterial color="#FF8C00" transparent opacity={0.75} depthWrite={false} />
        </mesh>
      )}

      {/* Device active pulse ring */}
      {obj.isAlexaDevice && isOn && obj.type !== 'smart-bulb' && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.16, 0.22, 28]} />
          <meshBasicMaterial color={obj.color ?? '#00A8E0'} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
