// Door frame + panel for a single doorway.
// wallAxis='X' → door sits in a horizontal wall (z-axis divider)
// wallAxis='Z' → door sits in a vertical wall (x-axis divider)
function Door({
  x, z, wallAxis, swingDir = 1,
}: {
  x: number; z: number; wallAxis: 'X' | 'Z'; swingDir?: 1 | -1;
}) {
  const W = 0.9;
  const H = 2.1;
  const T = 0.13;
  const frameY = H / 2;
  const rotY = wallAxis === 'X' ? 0 : Math.PI / 2;
  const panelSwing = (Math.PI / 10) * swingDir; // 18° ajar

  return (
    <group position={[x, 0, z]}>
      {/* Left frame post */}
      <mesh position={[-W / 2 - 0.065, frameY, 0]} rotation={[0, rotY, 0]} castShadow>
        <boxGeometry args={[0.13, H + 0.1, T + 0.05]} />
        <meshStandardMaterial color="#7B5030" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Right frame post */}
      <mesh position={[W / 2 + 0.065, frameY, 0]} rotation={[0, rotY, 0]} castShadow>
        <boxGeometry args={[0.13, H + 0.1, T + 0.05]} />
        <meshStandardMaterial color="#7B5030" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Top lintel */}
      <mesh position={[0, H + 0.05, 0]} rotation={[0, rotY, 0]} castShadow>
        <boxGeometry args={[W + 0.26, 0.12, T + 0.05]} />
        <meshStandardMaterial color="#7B5030" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Door panel — hinged at left, slightly ajar */}
      <group position={[-W / 2, 0, 0]} rotation={[0, panelSwing, 0]}>
        <mesh position={[W / 2, H / 2, 0]} rotation={[0, rotY, 0]} castShadow receiveShadow>
          <boxGeometry args={[W, H, 0.045]} />
          <meshStandardMaterial color="#A06840" roughness={0.65} metalness={0.0} />
        </mesh>
        {/* Raised panel details */}
        {[H * 0.27, H * 0.67].map((py, i) => (
          <mesh key={i} position={[W / 2, py, 0.025]} rotation={[0, rotY, 0]}>
            <boxGeometry args={[W * 0.62, H * 0.26, 0.012]} />
            <meshStandardMaterial color="#8C5828" roughness={0.7} />
          </mesh>
        ))}
        {/* Knob */}
        <mesh position={[W * 0.8, H * 0.47, 0.052]} rotation={[0, rotY, 0]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshStandardMaterial color="#C8A830" roughness={0.2} metalness={0.8} />
        </mesh>
        {/* Knob stem */}
        <mesh position={[W * 0.8, H * 0.47, 0.036]} rotation={[0, rotY, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.04, 8]} />
          <meshStandardMaterial color="#B09020" roughness={0.3} metalness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

export function Doors() {
  return (
    <group>
      {/* Main entrance — north wall of living room */}
      <Door x={-7} z={-8} wallAxis="X" swingDir={1} />

      {/* Living Room ↔ Kitchen — wall at x=4 */}
      <Door x={4} z={-6} wallAxis="Z" swingDir={-1} />

      {/* Living Room ↔ Master Bedroom — wall at z=0 */}
      <Door x={-8} z={0} wallAxis="X" swingDir={1} />

      {/* Living Room ↔ Bathroom zone — wall at z=0, centred on smaller bathroom */}
      <Door x={-2} z={0} wallAxis="X" swingDir={-1} />

      {/* Kitchen ↔ Office — wall at z=0 */}
      <Door x={8} z={0} wallAxis="X" swingDir={1} />

      {/* Master Bedroom ↔ Bathroom — wall at x=-4 */}
      <Door x={-4} z={4} wallAxis="Z" swingDir={1} />
    </group>
  );
}
