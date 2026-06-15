import * as THREE from 'three';
import { TOON_GRADIENT } from './ToonMaterial'; // still used for glass transparency

void (THREE.Color);

function mat(color: string, emissive = '#000', emissiveIntensity = 0, roughness = 0.75, metalness = 0.05) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

// ── Reusable window component ─────────────────────────────────────────────────
function Win({ x, y = 1.45, z, rotY = 0 }: { x: number; y?: number; z: number; rotY?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[1.32, 1.15, 0.1]} />
        {mat('#8B6F47')}
      </mesh>
      {/* Glass pane */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[1.14, 0.97, 0.02]} />
        <meshStandardMaterial
          color="#B3DEF5"
          emissive="#90C8E8"
          emissiveIntensity={0.25}
          transparent
          opacity={0.52}
        />
      </mesh>
      {/* Horizontal cross bar */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[1.12, 0.045, 0.045]} />
        {mat('#8B6F47')}
      </mesh>
      {/* Vertical cross bar */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.045, 0.95, 0.045]} />
        {mat('#8B6F47')}
      </mesh>
      {/* Sill */}
      <mesh position={[0, -0.62, 0.05]}>
        <boxGeometry args={[1.42, 0.07, 0.18]} />
        {mat('#A0856A')}
      </mesh>
    </group>
  );
}

// ── Windows on all exterior walls ─────────────────────────────────────────────
function Windows() {
  const H = Math.PI / 2;
  return (
    <group>
      {/* Living room — north wall (z=-8), two windows */}
      <Win x={-9}  y={1.45} z={-7.96} rotY={0} />
      <Win x={-3}  y={1.45} z={-7.96} rotY={0} />
      {/* Living room — west wall (x=-12) */}
      <Win x={-11.96} y={1.45} z={-5} rotY={H} />

      {/* Kitchen — north wall (z=-8) */}
      <Win x={8}  y={1.45} z={-7.96} rotY={0} />
      {/* Kitchen — east wall (x=12) */}
      <Win x={11.96} y={1.45} z={-5} rotY={H} />

      {/* Master bedroom — west wall (x=-12) */}
      <Win x={-11.96} y={1.45} z={4} rotY={H} />
      {/* Master bedroom — south wall (z=8) */}
      <Win x={-8} y={1.45} z={7.96} rotY={0} />

      {/* Office — east wall (x=12) */}
      <Win x={11.96} y={1.45} z={4} rotY={H} />
      {/* Office — south wall (z=8) */}
      <Win x={8} y={1.45} z={7.96} rotY={0} />

      {/* Bathroom — south wall (z=8), small frosted window */}
      <Win x={-2} y={1.7} z={7.96} rotY={0} />
    </group>
  );
}

// ── Kitchen counter + stove + fridge ──────────────────────────────────────────
function KitchenFixtures() {
  return (
    <group>
      {/* Counter along north wall (z=-7.5) of kitchen, x[5,11] */}
      <mesh position={[8, 0.46, -7.3]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.9, 0.7]} />
        {mat('#D7CCC8')}
      </mesh>
      {/* Countertop slab */}
      <mesh position={[8, 0.92, -7.3]} castShadow>
        <boxGeometry args={[5.5, 0.06, 0.72]} />
        {mat('#BCAAA4')}
      </mesh>
      {/* Sink basin */}
      <mesh position={[6.5, 0.84, -7.28]}>
        <boxGeometry args={[0.7, 0.14, 0.44]} />
        {mat('#90A4AE')}
      </mesh>
      {/* Tap */}
      <mesh position={[6.5, 1.04, -7.52]}>
        <cylinderGeometry args={[0.018, 0.018, 0.26, 8]} />
        {mat('#B0BEC5')}
      </mesh>
      <mesh position={[6.5, 1.18, -7.36]} rotation={[Math.PI / 2.5, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
        {mat('#B0BEC5')}
      </mesh>
      {/* Stove */}
      <mesh position={[9.2, 0.92, -7.28]}>
        <boxGeometry args={[0.7, 0.03, 0.56]} />
        {mat('#1a1a1a')}
      </mesh>
      {/* Burners */}
      {[[-0.18, -0.13], [0.18, -0.13], [-0.18, 0.13], [0.18, 0.13]].map(([bx, bz], i) => (
        <mesh key={i} position={[9.2 + bx, 0.945, -7.28 + bz]}>
          <cylinderGeometry args={[0.07, 0.07, 0.01, 12]} />
          {mat('#444')}
        </mesh>
      ))}
      {/* Chimney / exhaust hood */}
      <mesh position={[9.2, 1.6, -7.5]} castShadow>
        <boxGeometry args={[0.85, 0.5, 0.1]} />
        {mat('#9E9E9E')}
      </mesh>
      <mesh position={[9.2, 2.0, -7.5]}>
        <boxGeometry args={[0.4, 0.8, 0.08]} />
        {mat('#BDBDBD')}
      </mesh>
      {/* Fridge */}
      <mesh position={[11.2, 0.9, -6.5]} castShadow receiveShadow>
        <boxGeometry args={[0.65, 1.82, 0.66]} />
        {mat('#E0E0E0')}
      </mesh>
      <mesh position={[11.2, 0.9, -6.16]}>
        <boxGeometry args={[0.6, 1.72, 0.02]} />
        {mat('#EEEEEE')}
      </mesh>
      {/* Fridge handle */}
      <mesh position={[11.1, 1.1, -6.14]}>
        <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
        {mat('#9E9E9E')}
      </mesh>
    </group>
  );
}

// ── Bathroom: compact fixtures all in left half (x ≤ 0) ──────────────────────
function BathroomFixtures() {
  return (
    <group>
      {/* Toilet — in left half */}
      <mesh position={[-2.8, 0.22, 1.2]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.44, 0.66]} />
        {mat('#F5F5F5')}
      </mesh>
      {/* Toilet tank */}
      <mesh position={[-2.8, 0.58, 0.88]}>
        <boxGeometry args={[0.38, 0.38, 0.22]} />
        {mat('#F0F0F0')}
      </mesh>
      {/* Toilet seat */}
      <mesh position={[-2.8, 0.46, 1.22]} rotation={[-0.1, 0, 0]}>
        <boxGeometry args={[0.38, 0.03, 0.52]} />
        {mat('#E8E8E8')}
      </mesh>

      {/* Vanity / sink unit — left half */}
      <mesh position={[-3.2, 0.4, 3.2]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.82, 0.48]} />
        {mat('#D7CCC8')}
      </mesh>
      {/* Countertop */}
      <mesh position={[-3.2, 0.82, 3.2]}>
        <boxGeometry args={[0.72, 0.05, 0.5]} />
        {mat('#BCAAA4')}
      </mesh>
      {/* Basin */}
      <mesh position={[-3.2, 0.78, 3.2]}>
        <boxGeometry args={[0.42, 0.12, 0.3]} />
        {mat('#90A4AE')}
      </mesh>
      {/* Tap */}
      <mesh position={[-3.2, 0.98, 3.0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.22, 8]} />
        {mat('#B0BEC5')}
      </mesh>
      {/* Mirror above vanity */}
      <mesh position={[-3.2, 1.45, 2.96]}>
        <boxGeometry args={[0.62, 0.7, 0.03]} />
        {mat('#CFD8DC')}
      </mesh>
      <mesh position={[-3.2, 1.45, 2.94]}>
        <boxGeometry args={[0.56, 0.64, 0.005]} />
        {mat('#E8F4F8', '#B0C8D8', 0.12)}
      </mesh>

      {/* Shower area — left half, against south wall */}
      <mesh position={[-2.0, 2.5, 7.2]}>
        <cylinderGeometry args={[0.018, 0.018, 3.2, 8]} rotation={[0, 0, Math.PI / 2]} />
        {mat('#9E9E9E')}
      </mesh>
      {/* Shower head */}
      <mesh position={[-2.0, 2.42, 7.6]}>
        <cylinderGeometry args={[0.06, 0.04, 0.12, 12]} />
        {mat('#B0BEC5')}
      </mesh>
      {/* Shower tray */}
      <mesh position={[-2.0, 0.02, 7.0]} receiveShadow>
        <boxGeometry args={[1.6, 0.04, 1.6]} />
        {mat('#E8E8E8')}
      </mesh>
    </group>
  );
}

// ── Bedroom: nightstands + rug ────────────────────────────────────────────────
function BedroomDecor() {
  return (
    <group>
      {/* Nightstand left */}
      <mesh position={[-9.2, 0.32, 6.5]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.62, 0.46]} />
        {mat('#6D4C41')}
      </mesh>
      <mesh position={[-9.2, 0.64, 6.5]}>
        <boxGeometry args={[0.52, 0.04, 0.48]} />
        {mat('#5D3C31')}
      </mesh>
      {/* Bedside lamp left */}
      <mesh position={[-9.2, 0.82, 6.5]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        {mat('#BCAAA4')}
      </mesh>
      <mesh position={[-9.2, 1.06, 6.5]}>
        <cylinderGeometry args={[0.12, 0.07, 0.22, 12]} />
        {mat('#FFF9C4', '#FFEE58', 0.4)}
      </mesh>

      {/* Nightstand right */}
      <mesh position={[-6.8, 0.32, 6.5]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.62, 0.46]} />
        {mat('#6D4C41')}
      </mesh>
      <mesh position={[-6.8, 0.64, 6.5]}>
        <boxGeometry args={[0.52, 0.04, 0.48]} />
        {mat('#5D3C31')}
      </mesh>
      {/* Bedside lamp right */}
      <mesh position={[-6.8, 0.82, 6.5]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        {mat('#BCAAA4')}
      </mesh>
      <mesh position={[-6.8, 1.06, 6.5]}>
        <cylinderGeometry args={[0.12, 0.07, 0.22, 12]} />
        {mat('#FFF9C4', '#FFEE58', 0.4)}
      </mesh>

      {/* Bedroom rug */}
      <mesh position={[-8, 0.005, 4.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.5, 2.2]} />
        {mat('#9575CD')}
      </mesh>
      <mesh position={[-8, 0.006, 4.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, 1.6]} />
        {mat('#7E57C2')}
      </mesh>

      {/* Dresser / chest of drawers */}
      <mesh position={[-5.5, 0.48, 0.8]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.96, 0.48]} />
        {mat('#6D4C41')}
      </mesh>
      <mesh position={[-5.5, 0.96, 0.8]}>
        <boxGeometry args={[0.92, 0.04, 0.5]} />
        {mat('#5D3C31')}
      </mesh>
      {/* Drawer handles */}
      {[0.24, 0, -0.24].map((dy, i) => (
        <mesh key={i} position={[-5.1, 0.48 + dy, 0.8]}>
          <boxGeometry args={[0.02, 0.04, 0.22]} />
          {mat('#B0A090')}
        </mesh>
      ))}
    </group>
  );
}

// ── Living room: rug + decor ───────────────────────────────────────────────────
function LivingRoomDecor() {
  return (
    <group>
      {/* Area rug under sofa + side sofas */}
      <mesh position={[-4, 0.005, -4.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.5, 4.0]} />
        {mat('#D32F2F')}
      </mesh>
      <mesh position={[-4, 0.006, -4.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 3.3]} />
        {mat('#B71C1C')}
      </mesh>
      <mesh position={[-4, 0.007, -4.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.0, 0.15]} />
        {mat('#FFCDD2')}
      </mesh>

      {/* TV unit lower shelving */}
      <mesh position={[-2.0, 0.2, -7.2]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.4, 0.4]} />
        {mat('#5D4037')}
      </mesh>
    </group>
  );
}

// ── Office: whiteboard + rug ──────────────────────────────────────────────────
function OfficeDecor() {
  return (
    <group>
      {/* Whiteboard on west wall (facing east into room) */}
      <mesh position={[5.04, 1.4, 3.5]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[2.0, 1.1, 0.06]} />
        {mat('#ECEFF1')}
      </mesh>
      <mesh position={[5.06, 1.4, 3.5]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.88, 0.98, 0.01]} />
        {mat('#F5F5F5', '#E3F2FD', 0.05)}
      </mesh>
      {/* Marker tray */}
      <mesh position={[5.05, 0.88, 3.5]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.8, 0.06, 0.12]} />
        {mat('#B0BEC5')}
      </mesh>

      {/* Office rug */}
      <mesh position={[8, 0.005, 3.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.0, 3.0]} />
        {mat('#455A64')}
      </mesh>
      <mesh position={[8, 0.006, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 2.4]} />
        {mat('#546E7A')}
      </mesh>

      {/* Second monitor stand on desk (right side) */}
      <mesh position={[9.8, 0.96, 1.5]} castShadow>
        <boxGeometry args={[0.72, 0.58, 0.1]} />
        {mat('#1A1A1A')}
      </mesh>
      <mesh position={[9.8, 0.68, 1.5]}>
        <cylinderGeometry args={[0.04, 0.06, 0.2, 8]} />
        {mat('#222')}
      </mesh>
    </group>
  );
}

// ── India context: Tulsi plant + prayer corner + water cooler ─────────────────
function IndiaDecor() {
  return (
    <group>
      {/* Tulsi pot — living room near entrance */}
      <mesh position={[2.5, 0.22, -1.2]} castShadow>
        <cylinderGeometry args={[0.14, 0.1, 0.44, 10]} />
        <meshStandardMaterial color="#B5451B" roughness={0.8} />
      </mesh>
      <mesh position={[2.5, 0.52, -1.2]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.8} />
      </mesh>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return (
          <mesh key={i} position={[2.5 + Math.cos(a) * 0.14, 0.54, -1.2 + Math.sin(a) * 0.14]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#388E3C" roughness={0.75} />
          </mesh>
        );
      })}

      {/* Prayer corner / Mandir shelf — master bedroom corner */}
      <mesh position={[-11.2, 1.2, 0.8]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.36]} />
        <meshStandardMaterial color="#C8860A" roughness={0.75} />
      </mesh>
      <mesh position={[-11.2, 1.32, 0.8]}>
        <cylinderGeometry args={[0.04, 0.05, 0.18, 8]} />
        <meshStandardMaterial color="#DAA520" emissive="#A07010" emissiveIntensity={0.3} roughness={0.7} />
      </mesh>
      {/* Diya */}
      <mesh position={[-11.0, 1.28, 0.7]}>
        <cylinderGeometry args={[0.04, 0.055, 0.04, 10]} />
        <meshStandardMaterial color="#C8860A" roughness={0.75} />
      </mesh>
      <mesh position={[-11.0, 1.32, 0.7]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#FFF176" emissive="#FFD600" emissiveIntensity={1.2} roughness={0.7} />
      </mesh>

      {/* Water cooler in kitchen */}
      <mesh position={[5.5, 0.5, -7.2]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 1.0, 0.36]} />
        <meshStandardMaterial color="#E0E0E0" roughness={0.75} />
      </mesh>
      <mesh position={[5.5, 1.05, -7.2]}>
        <cylinderGeometry args={[0.14, 0.14, 0.24, 12]} />
      </mesh>
      {[-0.07, 0.07].map((x, i) => (
        <mesh key={i} position={[5.5 + x, 0.68, -7.0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
        </mesh>
      ))}
    </group>
  );
}

export function HouseDecor() {
  return (
    <group>
      <Windows />
      <KitchenFixtures />
      <BathroomFixtures />
      <BedroomDecor />
      <LivingRoomDecor />
      <OfficeDecor />
      <IndiaDecor />
    </group>
  );
}
