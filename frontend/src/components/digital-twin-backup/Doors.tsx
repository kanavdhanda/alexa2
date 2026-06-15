import { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Frame-rate independent animated door with frosted glass panel and modern lever handle.
// wallAxis='X' → door sits in a wall running east-west (door faces north/south)
// wallAxis='Z' → door sits in a wall running north-south (door faces east/west)
function Door({
  x, z, wallAxis, swingDir = 1,
}: {
  x: number; z: number; wallAxis: 'X' | 'Z'; swingDir?: 1 | -1;
}) {
  const W = 0.92;
  const H = 2.15;
  const T = 0.14;

  const [isOpen, setIsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const panelRef = useRef<THREE.Group>(null);

  const ry = wallAxis === 'Z' ? Math.PI / 2 : 0;
  const targetRotation = isOpen ? (Math.PI / 2.2) * swingDir : 0;

  useFrame((_, delta) => {
    if (panelRef.current) {
      const speed = 10;
      panelRef.current.rotation.y += (targetRotation - panelRef.current.rotation.y) * speed * delta;
    }
  });

  const woodColor = hovered ? '#4A4A4C' : '#2A2A2C';

  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* Left post */}
      <mesh position={[-W / 2 - 0.07, H / 2, 0]} castShadow>
        <boxGeometry args={[0.14, H + 0.12, T + 0.06]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Right post */}
      <mesh position={[W / 2 + 0.07, H / 2, 0]} castShadow>
        <boxGeometry args={[0.14, H + 0.12, T + 0.06]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.2} metalness={0.85} />
      </mesh>
      {/* Top lintel */}
      <mesh position={[0, H + 0.07, 0]} castShadow>
        <boxGeometry args={[W + 0.30, 0.14, T + 0.06]} />
        <meshStandardMaterial color="#CCCCCC" roughness={0.2} metalness={0.85} />
      </mesh>

      <group
        ref={panelRef}
        position={[-W / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <mesh position={[0.11, H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, H, 0.04]} />
          <meshStandardMaterial color={woodColor} roughness={0.7} />
        </mesh>
        <mesh position={[W - 0.11, H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, H, 0.04]} />
          <meshStandardMaterial color={woodColor} roughness={0.7} />
        </mesh>
        <mesh position={[W / 2, H - 0.075, 0]} castShadow receiveShadow>
          <boxGeometry args={[W - 0.44, 0.15, 0.04]} />
          <meshStandardMaterial color={woodColor} roughness={0.7} />
        </mesh>
        <mesh position={[W / 2, 0.075, 0]} castShadow receiveShadow>
          <boxGeometry args={[W - 0.44, 0.15, 0.04]} />
          <meshStandardMaterial color={woodColor} roughness={0.7} />
        </mesh>
        <mesh position={[W / 2, H / 2, 0]}>
          <boxGeometry args={[W - 0.44, H - 0.3, 0.015]} />
          <meshStandardMaterial
            color="#E0F7FA" emissive="#B2EBF2" emissiveIntensity={0.12}
            transparent opacity={0.45} roughness={0.1} metalness={0.1} side={THREE.DoubleSide}
          />
        </mesh>
        <group position={[W * 0.82, H * 0.47, 0]}>
          <mesh position={[0, 0, 0.022]}>
            <boxGeometry args={[0.04, 0.12, 0.005]} />
            <meshStandardMaterial color="#B0B0B0" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
            <meshStandardMaterial color="#C0C0C4" roughness={0.15} metalness={0.95} />
          </mesh>
          <mesh position={[-0.04, 0, 0.04]}>
            <boxGeometry args={[0.1, 0.015, 0.015]} />
            <meshStandardMaterial color="#C0C0C4" roughness={0.15} metalness={0.95} />
          </mesh>
          <mesh position={[0, 0, -0.022]}>
            <boxGeometry args={[0.04, 0.12, 0.005]} />
            <meshStandardMaterial color="#B0B0B0" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} />
            <meshStandardMaterial color="#C0C0C4" roughness={0.15} metalness={0.95} />
          </mesh>
          <mesh position={[-0.04, 0, -0.04]}>
            <boxGeometry args={[0.1, 0.015, 0.015]} />
            <meshStandardMaterial color="#C0C0C4" roughness={0.15} metalness={0.95} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function Doors() {
  return (
    <group>
      {/* Main entrance — north wall of living room (z=-8) */}
      <Door x={-7} z={-8} wallAxis="X" swingDir={1} />

      {/* Living Room ↔ Mandir — shared wall at x=4, z=-6 (NE Mandir) */}
      <Door x={4} z={-6} wallAxis="Z" swingDir={-1} />

      {/* Living Room ↔ Kitchen — shared wall at x=4, z=-2 (new kitchen) */}
      <Door x={4} z={-2} wallAxis="Z" swingDir={-1} />

      {/* Mandir ↔ Kitchen — horizontal divider at z=-4 */}
      <Door x={8} z={-4} wallAxis="X" swingDir={1} />

      {/* Living Room ↔ Master Bedroom — wall at z=0 */}
      <Door x={-8} z={0} wallAxis="X" swingDir={1} />

      {/* Living Room ↔ Bathroom — wall at z=0 */}
      <Door x={-1} z={0} wallAxis="X" swingDir={-1} />

      {/* Kitchen ↔ Office — wall at z=0 */}
      <Door x={8} z={0} wallAxis="X" swingDir={1} />

      {/* Master Bedroom ↔ Bathroom — wall at x=-4 */}
      <Door x={-4} z={4} wallAxis="Z" swingDir={1} />
    </group>
  );
}
