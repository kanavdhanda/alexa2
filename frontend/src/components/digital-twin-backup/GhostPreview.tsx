import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';

// Surface-bound assets snap to table-top height
const SURFACE_BOUND: string[] = ['echo-dot', 'echo-show', 'smart-plug', 'thermostat'];
// Wall-mounted assets appear at mid-wall height
const WALL_MOUNTED: string[] = ['camera', 'motion-sensor', 'smoke-detector', 'doorbell'];

const SNAP = 0.25;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

export function GhostPreview() {
  const { camera, pointer, raycaster } = useThree();
  const { ui, rooms } = useAppStore();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const isActive = ui.isPlacementMode && !!ui.placementAssetType;

  useFrame(() => {
    if (!meshRef.current || !materialRef.current || !isActive) return;

    raycaster.setFromCamera(pointer, camera);

    // Determine placement height
    const assetType = ui.placementAssetType!;
    let yLevel = 0;
    if (SURFACE_BOUND.includes(assetType)) yLevel = 0.78; // approx table-top
    if (WALL_MOUNTED.includes(assetType)) yLevel = 1.8;   // mid-wall

    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLevel);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(floor, hit);
    if (!ok) return;

    const sx = snap(hit.x);
    const sz = snap(hit.z);

    meshRef.current.position.set(sx, yLevel + 0.01, sz);

    // Check if position is inside a room
    const insideRoom = rooms.some((room) => {
      const hw = room.width / 2;
      const hd = room.depth / 2;
      return (
        sx >= room.position.x - hw &&
        sx <= room.position.x + hw &&
        sz >= room.position.z - hd &&
        sz <= room.position.z + hd
      );
    });

    // Green = valid placement inside house, red = outside
    materialRef.current.color.set(insideRoom ? '#00FF88' : '#FF3333');
    materialRef.current.emissive.set(insideRoom ? '#00AA44' : '#AA0000');
    materialRef.current.opacity = 0.45;
  });

  if (!isActive) return null;

  return (
    <mesh ref={meshRef} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#00FF88"
        emissive="#00AA44"
        emissiveIntensity={0.6}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </mesh>
  );
}
