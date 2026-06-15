import * as THREE from 'three';
import { FlowerVaseGeometry } from './FurnitureGeometry';

const PI = Math.PI;
const H = PI / 2;

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

// ── Abstract Canvas Print component ───────────────────────────────────────────
function AbstractPainting({ w = 1.1, h = 0.85, inner = '#1565C0', accent = '#FF9800' }) {
  return (
    <group>
      {/* Outer wooden frame */}
      <mesh castShadow>
        <boxGeometry args={[w + 0.10, h + 0.10, 0.04]} />
        {mat('#3E2723', '#000', 0, 0.78, 0.08)}
      </mesh>
      {/* Matte print canvas backing */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[w, h, 0.012]} />
        {mat('#F5F5F0', '#000', 0, 0.95)}
      </mesh>
      {/* Modern abstract geometric block */}
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[w * 0.8, h * 0.8]} />
        {mat(inner, '#000', 0, 0.9)}
      </mesh>
      {/* Decorative offset circle print */}
      <mesh position={[w * 0.18, -h * 0.12, 0.028]}>
        <ringGeometry args={[0, h * 0.22, 32]} />
        {mat(accent, '#000', 0, 0.9)}
      </mesh>
      {/* Diagonal design stripe */}
      <mesh position={[-w * 0.15, h * 0.15, 0.03]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[w * 0.08, h * 0.65]} />
        {mat('#212121', '#000', 0, 0.9)}
      </mesh>
    </group>
  );
}

// ── Window ────────────────────────────────────────────────────────────────────
function Win({ x, y = 1.45, z, rotY = 0 }: { x: number; y?: number; z: number; rotY?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {/* Hollow Frame (Top, Bottom, Left, Right) */}
      <mesh position={[0, 0.53, 0]} castShadow>
        <boxGeometry args={[1.32, 0.09, 0.10]} />
        {mat('#8B6F47', '#000', 0, 0.72)}
      </mesh>
      <mesh position={[0, -0.53, 0]} castShadow>
        <boxGeometry args={[1.32, 0.09, 0.10]} />
        {mat('#8B6F47', '#000', 0, 0.72)}
      </mesh>
      <mesh position={[-0.615, 0, 0]} castShadow>
        <boxGeometry args={[0.09, 0.97, 0.10]} />
        {mat('#8B6F47', '#000', 0, 0.72)}
      </mesh>
      <mesh position={[0.615, 0, 0]} castShadow>
        <boxGeometry args={[0.09, 0.97, 0.10]} />
        {mat('#8B6F47', '#000', 0, 0.72)}
      </mesh>

      {/* Glass Pane (Double Sided for visibility from both directions) */}
      <mesh position={[0, 0, 0.00]}>
        <boxGeometry args={[1.14, 0.97, 0.015]} />
        <meshStandardMaterial
          color="#B3DEF5"
          emissive="#90C8E8"
          emissiveIntensity={0.28}
          transparent
          opacity={0.54}
          roughness={0.08}
          metalness={0.0}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[1.12, 0.045, 0.045]} />
        {mat('#8B6F47')}
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <boxGeometry args={[0.045, 0.95, 0.045]} />
        {mat('#8B6F47')}
      </mesh>
      <mesh position={[0, -0.62, 0.04]}>
        <boxGeometry args={[1.42, 0.07, 0.18]} />
        {mat('#A0856A')}
      </mesh>
    </group>
  );
}

// ── All exterior windows (Static/Click-Through) ────────────────────────────────
export function Windows() {
  return (
    <group raycast={() => null}>
      <Win x={-9}     y={1.45} z={-7.96} rotY={0} />
      <Win x={-3}     y={1.45} z={-7.96} rotY={0} />
      <Win x={-11.96} y={1.45} z={-5}    rotY={H} />
      <Win x={8}      y={1.45} z={-7.96} rotY={0} />
      <Win x={11.96}  y={1.45} z={-5}    rotY={H} />
      <Win x={-11.96} y={1.45} z={4}     rotY={H} />
      <Win x={-8}     y={1.45} z={7.96}  rotY={0} />
      <Win x={11.96}  y={1.45} z={4}     rotY={H} />
      <Win x={8}      y={1.45} z={7.96}  rotY={0} />
      <Win x={-2}     y={1.70} z={7.96}  rotY={0} />
    </group>
  );
}

// ── Window sunlight patches (Local coordinates) ──────────────────────────────
function SunPatches({ roomId }: { roomId: string }) {
  const hour = new Date().getHours();
  if (hour < 6 || hour >= 20) return null;
  const c = hour < 9 || hour >= 17 ? '#FFD070' : '#FFF8D0';
  const oi = hour < 9 || hour >= 17 ? 0.18 : 0.10;

  if (roomId === 'living-room') {
    return (
      <group>
        <mesh position={[-5, 0.004, -2]} rotation={[-PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 3.0]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={oi} transparent opacity={0.22} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
        <mesh position={[1, 0.004, -2]} rotation={[-PI / 2, 0, 0]}>
          <planeGeometry args={[1.1, 3.0]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={oi} transparent opacity={0.22} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      </group>
    );
  }

  if (roomId === 'kitchen') {
    return (
      <mesh position={[0, 0.004, -2]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 3.0]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={oi} transparent opacity={0.22} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
    );
  }

  if (roomId === 'office') {
    return (
      <mesh position={[0, 0.004, 2.5]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 2.5]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={oi} transparent opacity={0.22} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
    );
  }

  return null;
}

// ── Living Room Decor (Local coordinates relative to center -4, -4) ──────────
export function LivingRoomDecor() {
  const xs = [-6.8, -5.6, -4.4, -3.2, -2.0, -0.8, 0.4, 1.6, 2.8, 4.0, 5.2, 6.4];
  return (
    <group raycast={() => null}>
      {/* Wood floor planks */}
      {xs.map((x, i) => (
        <mesh key={i} position={[x, 0.003, 0]} rotation={[-PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[0.04, 8]} />
          <meshStandardMaterial color="#6B4020" roughness={1} transparent opacity={0.22} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      ))}

      {/* Sun Patches */}
      <SunPatches roomId="living-room" />

      {/* Area rug */}
      <mesh position={[0, 0.005, -0.2]} rotation={[-PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.5, 4.0]} />
        {mat('#C62828')}
      </mesh>
      <mesh position={[0, 0.006, -0.2]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[4.8, 3.3]} />
        {mat('#B71C1C')}
      </mesh>
      <mesh position={[0, 0.007, -0.2]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[4.0, 0.15]} />
        {mat('#FFCDD2')}
      </mesh>

      {/* Curtains — left and right windows */}
      <mesh position={[-5, 1.6, -3.94]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.65, 2.4, 0.06]} />
        {mat('#8D1515', '#000', 0, 0.95)}
      </mesh>
      <mesh position={[1, 1.6, -3.94]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.65, 2.4, 0.06]} />
        {mat('#8D1515', '#000', 0, 0.95)}
      </mesh>

      {/* TV unit lower shelving */}
      <mesh position={[2.0, 0.2, -3.2]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.4, 0.4]} />
        {mat('#5D4037')}
      </mesh>

      {/* Coffee table magazine tray */}
      <mesh position={[0, 0.36, -0.8]}>
        <boxGeometry args={[0.5, 0.015, 0.36]} />
        {mat('#8D6E63')}
      </mesh>

      {/* Wall art print - abstract landscape */}
      <group position={[-2, 1.52, -3.94]}>
        <AbstractPainting w={1.3} h={0.9} inner="#1A4060" accent="#FF9800" />
      </group>

      {/* Tulsi pot near main entry */}
      <mesh position={[6.5, 0.22, 2.8]} castShadow>
        <cylinderGeometry args={[0.14, 0.10, 0.44, 10]} />
        <meshStandardMaterial color="#B5451B" roughness={0.8} />
      </mesh>
      <mesh position={[6.5, 0.52, 2.8]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.8} />
      </mesh>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const a = (deg * PI) / 180;
        return (
          <mesh key={i} position={[6.5 + Math.cos(a) * 0.14, 0.54, 2.8 + Math.sin(a) * 0.14]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#388E3C" roughness={0.75} />
          </mesh>
        );
      })}

      {/* Flower vase on coffee table */}
      <group position={[0, 0.78, 0.1]}>
        <FlowerVaseGeometry />
      </group>
    </group>
  );
}

// ── Kitchen Decor (Local coordinates relative to center 8, -4) ────────────────
export function KitchenDecor() {
  const now = new Date();
  const hrs = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * PI * 2;
  const min = now.getMinutes() / 60 * PI * 2;

  return (
    <group raycast={() => null}>
      {/* Sun Patches */}
      <SunPatches roomId="kitchen" />

      {/* Counter along north wall */}
      <mesh position={[0, 0.46, -3.3]} castShadow receiveShadow>
        <boxGeometry args={[5.5, 0.9, 0.7]} />
        {mat('#D7CCC8')}
      </mesh>
      <mesh position={[0, 0.92, -3.3]} castShadow>
        <boxGeometry args={[5.5, 0.06, 0.72]} />
        {mat('#BCAAA4')}
      </mesh>
      {/* Sink */}
      <mesh position={[-1.5, 0.84, -3.28]}>
        <boxGeometry args={[0.7, 0.14, 0.44]} />
        {mat('#90A4AE')}
      </mesh>
      <mesh position={[-1.5, 1.04, -3.52]}>
        <cylinderGeometry args={[0.018, 0.018, 0.26, 8]} />
        {mat('#B0BEC5')}
      </mesh>
      <mesh position={[-1.5, 1.18, -3.36]} rotation={[PI / 2.5, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 8]} />
        {mat('#B0BEC5')}
      </mesh>
      {/* Stove top */}
      <mesh position={[1.2, 0.92, -3.28]}>
        <boxGeometry args={[0.7, 0.03, 0.56]} />
        {mat('#1a1a1a')}
      </mesh>
      {[[-0.18, -0.13], [0.18, -0.13], [-0.18, 0.13], [0.18, 0.13]].map(([bx, bz], i) => (
        <mesh key={i} position={[1.2 + bx, 0.945, -3.28 + bz]}>
          <cylinderGeometry args={[0.07, 0.07, 0.01, 12]} />
          {mat('#444')}
        </mesh>
      ))}
      {/* Hood */}
      <mesh position={[1.2, 1.6, -3.5]} castShadow>
        <boxGeometry args={[0.85, 0.5, 0.1]} />
        {mat('#9E9E9E')}
      </mesh>
      <mesh position={[1.2, 2.0, -3.5]}>
        <boxGeometry args={[0.4, 0.8, 0.08]} />
        {mat('#BDBDBD')}
      </mesh>
      {/* Fridge */}
      <mesh position={[3.2, 0.9, -2.5]} castShadow receiveShadow>
        <boxGeometry args={[0.65, 1.82, 0.66]} />
        {mat('#E0E0E0')}
      </mesh>
      <mesh position={[3.2, 0.9, -2.16]}>
        <boxGeometry args={[0.6, 1.72, 0.02]} />
        {mat('#EEEEEE')}
      </mesh>
      <mesh position={[3.1, 1.1, -2.14]}>
        <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
        {mat('#9E9E9E')}
      </mesh>
      {/* Overhead cabinet strip */}
      <mesh position={[0, 2.28, -3.55]} castShadow>
        <boxGeometry args={[5.4, 0.72, 0.42]} />
        {mat('#BCAAA4')}
      </mesh>

      {/* Wall clock on east wall */}
      <group position={[3.94, 1.8, 0]} rotation={[0, -H, 0]}>
        <mesh>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 24]} />
          <meshStandardMaterial color="#F5F5F0" roughness={0.6} />
        </mesh>
        <mesh position={[Math.sin(hrs) * 0.07, 0.025, -Math.cos(hrs) * 0.07]} rotation={[hrs, 0, 0]}>
          <boxGeometry args={[0.02, 0.01, 0.10]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh position={[Math.sin(min) * 0.10, 0.026, -Math.cos(min) * 0.10]} rotation={[min, 0, 0]}>
          <boxGeometry args={[0.012, 0.01, 0.14]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <mesh position={[0, 0.028, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 8]} />
          <meshStandardMaterial color="#C8A020" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.22, 0.018, 8, 24]} />
          <meshStandardMaterial color="#8B6F47" roughness={0.7} />
        </mesh>
      </group>

      {/* Water cooler */}
      <mesh position={[-2.5, 0.5, -3.2]} castShadow receiveShadow>
        <boxGeometry args={[0.36, 1.0, 0.36]} />
        <meshStandardMaterial color="#E0E0E0" roughness={0.75} />
      </mesh>
      <mesh position={[-2.5, 1.05, -3.2]}>
        <cylinderGeometry args={[0.14, 0.14, 0.24, 12]} />
        <meshStandardMaterial color="#3A6BA8" roughness={0.5} metalness={0.1} transparent opacity={0.7} />
      </mesh>
      {[-0.07, 0.07].map((xVal, i) => (
        <mesh key={i} position={[-2.5 + xVal, 0.68, -3.0]} rotation={[PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.1, 6]} />
          <meshStandardMaterial color="#BDBDBD" roughness={0.3} metalness={0.6} />
        </mesh>
      ))}

      {/* Pressure cooker on stove top */}
      <group position={[1.2, 0.95, -3.28]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.12, 0.11, 0.18, 16]} />
          <meshStandardMaterial color="#B0B8C0" roughness={0.25} metalness={0.75} />
        </mesh>
        {/* Lid */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.125, 0.125, 0.03, 16]} />
          <meshStandardMaterial color="#A8B0B8" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Pressure weight on lid */}
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.04, 8]} />
          <meshStandardMaterial color="#E0C060" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.16, 0.13, 0]} rotation={[0, 0, 0.3]} castShadow>
          <boxGeometry args={[0.06, 0.024, 0.032]} />
          <meshStandardMaterial color="#222" roughness={0.85} />
        </mesh>
      </group>

      {/* Flower vase on dining table */}
      <group position={[0, 0.78, -0.5]}>
        <FlowerVaseGeometry />
      </group>
    </group>
  );
}

// ── Bathroom Decor (Local coordinates relative to center -2, 4) ────────────────
export function BathroomDecor() {
  return (
    <group raycast={() => null}>
      {/* Toilet — NW corner */}
      <mesh position={[-1.0, 0.22, -2.5]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.44, 0.68]} />
        {mat('#F5F5F5')}
      </mesh>
      <mesh position={[-1.0, 0.58, -2.78]}>
        <boxGeometry args={[0.40, 0.38, 0.24]} />
        {mat('#F0F0F0')}
      </mesh>
      <mesh position={[-1.0, 0.46, -2.48]} rotation={[-0.1, 0, 0]}>
        <boxGeometry args={[0.40, 0.03, 0.54]} />
        {mat('#E8E8E8')}
      </mesh>

      {/* Vanity / sink unit */}
      <mesh position={[-1.2, 0.42, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[0.68, 0.84, 0.50]} />
        {mat('#D7CCC8')}
      </mesh>
      <mesh position={[-1.2, 0.85, -0.5]}>
        <boxGeometry args={[0.70, 0.05, 0.52]} />
        {mat('#BCAAA4')}
      </mesh>
      <mesh position={[-1.2, 0.80, -0.5]}>
        <boxGeometry args={[0.44, 0.12, 0.32]} />
        {mat('#90A4AE')}
      </mesh>
      <mesh position={[-1.2, 1.00, -0.72]}>
        <cylinderGeometry args={[0.015, 0.015, 0.22, 8]} />
        {mat('#B0BEC5')}
      </mesh>
      {/* Mirror */}
      <mesh position={[-1.2, 1.48, -0.76]}>
        <boxGeometry args={[0.64, 0.72, 0.03]} />
        {mat('#CFD8DC')}
      </mesh>
      <mesh position={[-1.2, 1.48, -0.78]}>
        <boxGeometry args={[0.58, 0.66, 0.005]} />
        {mat('#E8F4F8', '#B0C8D8', 0.14)}
      </mesh>

      {/* Towel rail on east wall */}
      <mesh position={[1.94, 1.12, -1.5]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.7]} />
        {mat('#B0BEC5', '#000', 0, 0.3, 0.6)}
      </mesh>
      <mesh position={[1.94, 1.12, -1.85]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
        {mat('#9E9E9E', '#000', 0, 0.3, 0.6)}
      </mesh>
      <mesh position={[1.94, 1.12, -1.15]}>
        <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
        {mat('#9E9E9E', '#000', 0, 0.3, 0.6)}
      </mesh>

      {/* Tile strip along north wall */}
      <mesh position={[0, 1.1, -3.93]} rotation={[0, 0, 0]}>
        <boxGeometry args={[4, 1.8, 0.02]} />
        {mat('#E3F0F6', '#000', 0, 0.4)}
      </mesh>
    </group>
  );
}

// ── Bedroom Decor (Local coordinates relative to center -8, 4) ────────────────
export function BedroomDecor() {
  return (
    <group raycast={() => null}>
      {/* Nightstand left */}
      <mesh position={[-1.2, 0.32, 2.5]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.62, 0.46]} />
        {mat('#6D4C41')}
      </mesh>
      <mesh position={[-1.2, 0.64, 2.5]}>
        <boxGeometry args={[0.52, 0.04, 0.48]} />
        {mat('#5D3C31')}
      </mesh>
      <mesh position={[-1.2, 0.82, 2.5]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        {mat('#BCAAA4')}
      </mesh>
      <mesh position={[-1.2, 1.06, 2.5]}>
        <cylinderGeometry args={[0.12, 0.07, 0.22, 12]} />
        {mat('#FFF9C4', '#FFEE58', 0.5)}
      </mesh>

      {/* Nightstand right */}
      <mesh position={[1.2, 0.32, 2.5]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.62, 0.46]} />
        {mat('#6D4C41')}
      </mesh>
      <mesh position={[1.2, 0.64, 2.5]}>
        <boxGeometry args={[0.52, 0.04, 0.48]} />
        {mat('#5D3C31')}
      </mesh>
      <mesh position={[1.2, 0.82, 2.5]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        {mat('#BCAAA4')}
      </mesh>
      <mesh position={[1.2, 1.06, 2.5]}>
        <cylinderGeometry args={[0.12, 0.07, 0.22, 12]} />
        {mat('#FFF9C4', '#FFEE58', 0.5)}
      </mesh>

      {/* Bedroom rug */}
      <mesh position={[0, 0.005, 0.5]} rotation={[-PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.8, 2.4]} />
        {mat('#7B3F9A')}
      </mesh>
      <mesh position={[0, 0.006, 0.5]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.0, 1.8]} />
        {mat('#6A2E88')}
      </mesh>
      <mesh position={[0, 0.007, 0.5]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.75, 0.12]} />
        {mat('#E0C0FF')}
      </mesh>

      {/* Dresser / chest of drawers */}
      <mesh position={[2.5, 0.48, -3.2]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.96, 0.48]} />
        {mat('#6D4C41')}
      </mesh>
      <mesh position={[2.5, 0.96, -3.2]}>
        <boxGeometry args={[0.92, 0.04, 0.5]} />
        {mat('#5D3C31')}
      </mesh>
      {[0.24, 0, -0.24].map((dy, i) => (
        <mesh key={i} position={[2.9, 0.48 + dy, -3.2]}>
          <boxGeometry args={[0.02, 0.04, 0.22]} />
          {mat('#B0A090')}
        </mesh>
      ))}

      {/* Curtains on west window */}
      <mesh position={[-3.94, 1.5, 0.6]} rotation={[0, H, 0]} castShadow>
        <boxGeometry args={[0.7, 2.2, 0.06]} />
        {mat('#8E24AA', '#000', 0, 0.95)}
      </mesh>
      <mesh position={[-3.94, 1.5, -0.6]} rotation={[0, H, 0]} castShadow>
        <boxGeometry args={[0.7, 2.2, 0.06]} />
        {mat('#8E24AA', '#000', 0, 0.95)}
      </mesh>

      {/* Mandir / Prayer Corner */}
      <mesh position={[-3.2, 1.2, -3.2]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.36]} />
        <meshStandardMaterial color="#C8860A" roughness={0.75} />
      </mesh>
      <mesh position={[-3.2, 1.32, -3.2]}>
        <cylinderGeometry args={[0.04, 0.05, 0.18, 8]} />
        <meshStandardMaterial color="#DAA520" emissive="#A07010" emissiveIntensity={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[-3.0, 1.28, -3.3]}>
        <cylinderGeometry args={[0.04, 0.055, 0.04, 10]} />
        <meshStandardMaterial color="#C8860A" roughness={0.75} />
      </mesh>
      <mesh position={[-3.0, 1.32, -3.3]}>
        <sphereGeometry args={[0.018, 6, 6]} />
        <meshStandardMaterial color="#FFF176" emissive="#FFD600" emissiveIntensity={1.4} />
      </mesh>

      {/* Wall art print - abstract red print */}
      <group position={[0, 1.52, 3.94]} rotation={[0, PI, 0]}>
        <AbstractPainting w={1.1} h={0.85} inner="#8B1A1A" accent="#C5A35E" />
      </group>

      {/* Flower vase on right nightstand */}
      <group position={[1.2, 0.64, 2.5]}>
        <FlowerVaseGeometry />
      </group>
    </group>
  );
}

// ── Office Decor (Local coordinates relative to center 8, 4) ──────────────────
export function OfficeDecor() {
  const WBX = -3.90;
  return (
    <group raycast={() => null}>
      {/* Whiteboard frame */}
      <mesh position={[WBX, 1.42, -0.5]} rotation={[0, H, 0]} castShadow>
        <boxGeometry args={[2.1, 1.15, 0.06]} />
        {mat('#ECEFF1')}
      </mesh>
      {/* Whiteboard surface */}
      <mesh position={[WBX + 0.02, 1.42, -0.5]} rotation={[0, H, 0]}>
        <boxGeometry args={[2.0, 1.04, 0.01]} />
        {mat('#F5F5F5', '#E3F2FD', 0.06)}
      </mesh>
      {/* Marker tray */}
      <mesh position={[WBX + 0.005, 0.90, -0.5]} rotation={[0, H, 0]}>
        <boxGeometry args={[1.9, 0.06, 0.12]} />
        {mat('#B0BEC5')}
      </mesh>
      {/* Some lines written on whiteboard */}
      {[0.18, 0.0, -0.18].map((dy, i) => (
        <mesh key={i} position={[WBX + 0.025, 1.42 + dy, -0.8 + i * 0.15]} rotation={[0, H, 0]}>
          <boxGeometry args={[0.5 + i * 0.2, 0.012, 0.006]} />
          <meshStandardMaterial color="#3A80C0" roughness={0.9} />
        </mesh>
      ))}

      {/* Office rug */}
      <mesh position={[0, 0.005, -0.8]} rotation={[-PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.2, 3.2]} />
        {mat('#3A4A54')}
      </mesh>
      <mesh position={[0, 0.006, -0.8]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 2.6]} />
        {mat('#4A5A65')}
      </mesh>

      {/* Second monitor (sitting on desk - now at desk relative pos) */}
      <mesh position={[1.6, 0.96, -2.5]} castShadow>
        <boxGeometry args={[0.72, 0.58, 0.08]} />
        {mat('#181818')}
      </mesh>
      <mesh position={[1.6, 0.96, -2.52]}>
        <boxGeometry args={[0.66, 0.52, 0.02]} />
        {mat('#0A1628', '#1A4A8A', 0.35)}
      </mesh>
      <mesh position={[1.6, 0.66, -2.5]}>
        <cylinderGeometry args={[0.04, 0.06, 0.22, 8]} />
        {mat('#222')}
      </mesh>
      <mesh position={[1.6, 0.55, -2.5]}>
        <boxGeometry args={[0.28, 0.04, 0.18]} />
        {mat('#1A1A1A')}
      </mesh>

      {/* Wall art print - abstract green print */}
      <group position={[3.94, 1.52, -2.5]} rotation={[0, -H, 0]}>
        <AbstractPainting w={0.9} h={0.7} inner="#1A3A20" accent="#D4AF37" />
      </group>

      {/* Flower vase on office desk */}
      <group position={[2.0, 0.78, -3.2]}>
        <FlowerVaseGeometry />
      </group>
    </group>
  );
}

// ── Mandir Decor (Local coordinates relative to centre 0, 11) ────────────────
// Room: x[-4,4], z[-3,3] in local space. Altar on north wall (z=-3), entrance south (z=3).
export function MandiDecor() {
  return (
    <group raycast={() => null}>

      {/* Marble altar platform — raised step along north wall */}
      <mesh position={[0, 0.12, -1.6]} castShadow receiveShadow>
        <boxGeometry args={[5.0, 0.24, 1.1]} />
        <meshStandardMaterial color="#F4ECD4" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Altar top shelf */}
      <mesh position={[0, 0.48, -1.6]}>
        <boxGeometry args={[5.0, 0.06, 1.1]} />
        <meshStandardMaterial color="#E8D8B4" roughness={0.25} metalness={0.08} />
      </mesh>
      {/* Back wall panel — painted saffron */}
      <mesh position={[0, 1.5, -1.95]} castShadow>
        <boxGeometry args={[5.2, 2.5, 0.06]} />
        <meshStandardMaterial color="#FF8C00" roughness={0.9} />
      </mesh>
      {/* Om symbol (disc) on back wall */}
      <mesh position={[0, 1.72, -1.92]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 32]} />
        <meshStandardMaterial color="#DAA520" emissive="#B8860B" emissiveIntensity={0.5} roughness={0.4} metalness={0.6} />
      </mesh>

      {/* ── Ganesh Ji Murti (largest, centre) ─────────────────────────── */}
      <group position={[0, 0.54, -1.65]}>
        {/* Body */}
        <mesh castShadow>
          <sphereGeometry args={[0.22, 14, 10]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.35} roughness={0.4} metalness={0.55} />
        </mesh>
        {/* Head (large elephant head) */}
        <mesh position={[0, 0.26, 0]} castShadow>
          <sphereGeometry args={[0.195, 14, 10]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.35} roughness={0.4} metalness={0.55} />
        </mesh>
        {/* Left ear */}
        <mesh position={[-0.21, 0.26, 0]} scale={[1, 0.62, 0.35]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.3} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Right ear */}
        <mesh position={[0.21, 0.26, 0]} scale={[1, 0.62, 0.35]} castShadow>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.3} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Trunk (curled down-left) */}
        <mesh position={[-0.06, 0.12, 0.14]} rotation={[0.4, 0.3, 0.5]}>
          <cylinderGeometry args={[0.045, 0.028, 0.26, 8]} />
          <meshStandardMaterial color="#C8A030" emissive="#8B6914" emissiveIntensity={0.3} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Crown */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.07, 0.14, 0.12, 10]} />
          <meshStandardMaterial color="#FFD700" emissive="#B8860B" emissiveIntensity={0.7} roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Lotus pedestal */}
        <mesh position={[0, -0.26, 0]}>
          <cylinderGeometry args={[0.16, 0.12, 0.08, 12]} />
          <meshStandardMaterial color="#FF9EBC" emissive="#FF5588" emissiveIntensity={0.25} roughness={0.6} />
        </mesh>
        {/* Pedestal base */}
        <mesh position={[0, -0.32, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 12]} />
          <meshStandardMaterial color="#E8D8B4" roughness={0.4} />
        </mesh>
      </group>

      {/* ── Lakshmi Ji Murti (right of Ganesh, smaller) ───────────────── */}
      <group position={[1.1, 0.54, -1.68]}>
        {/* Body */}
        <mesh castShadow>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.3} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.17, 0]} castShadow>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.3} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Crown */}
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.035, 0.07, 0.07, 8]} />
          <meshStandardMaterial color="#FFD700" emissive="#B8860B" emissiveIntensity={0.6} roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Lotus base */}
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.06, 10]} />
          <meshStandardMaterial color="#FF9EBC" emissive="#FF5588" emissiveIntensity={0.2} roughness={0.6} />
        </mesh>
        {/* Label plaque */}
        <mesh position={[0, -0.2, 0.1]}>
          <boxGeometry args={[0.18, 0.04, 0.02]} />
          <meshStandardMaterial color="#C8A030" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* ── Ram Ji Murti (left of Ganesh, smaller) ────────────────────── */}
      <group position={[-1.1, 0.54, -1.68]}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 10, 8]} />
          <meshStandardMaterial color="#4A90D9" emissive="#1A5090" emissiveIntensity={0.3} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.17, 0]} castShadow>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#4A90D9" emissive="#1A5090" emissiveIntensity={0.3} roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Bow prop */}
        <mesh position={[0.12, 0.05, 0.06]} rotation={[0, 0, 0.4]}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
          <meshStandardMaterial color="#6D4C41" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.035, 0.07, 0.07, 8]} />
          <meshStandardMaterial color="#FFD700" emissive="#B8860B" emissiveIntensity={0.6} roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.06, 10]} />
          <meshStandardMaterial color="#FF9EBC" emissive="#FF5588" emissiveIntensity={0.2} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Smaller deity (Durga/Saraswati) — far right ──────────────── */}
      <group position={[1.9, 0.52, -1.68]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 8, 7]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.25} roughness={0.55} metalness={0.45} />
        </mesh>
        <mesh position={[0, 0.14, 0]}>
          <sphereGeometry args={[0.08, 8, 7]} />
          <meshStandardMaterial color="#D4AF37" emissive="#8B6914" emissiveIntensity={0.25} roughness={0.55} metalness={0.45} />
        </mesh>
        <mesh position={[0, -0.13, 0]}>
          <cylinderGeometry args={[0.08, 0.06, 0.05, 10]} />
          <meshStandardMaterial color="#FF9EBC" emissive="#FF5588" emissiveIntensity={0.2} roughness={0.6} />
        </mesh>
      </group>

      {/* ── Diyas (oil lamps) — row in front of deities ───────────────── */}
      {[-1.5, -0.75, 0, 0.75, 1.5].map((dx, i) => (
        <group key={i} position={[dx, 0.54, -1.45]}>
          {/* Diya clay bowl */}
          <mesh>
            <cylinderGeometry args={[0.055, 0.035, 0.04, 10]} />
            <meshStandardMaterial color="#C8794A" roughness={0.8} />
          </mesh>
          {/* Flame (emissive teardrop) */}
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.022, 6, 6]} />
            <meshStandardMaterial color="#FFF176" emissive="#FF9800" emissiveIntensity={2.0} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* ── Incense sticks holder ──────────────────────────────────────── */}
      <group position={[-1.9, 0.5, -1.5]}>
        {/* Holder base */}
        <mesh>
          <cylinderGeometry args={[0.05, 0.04, 0.06, 8]} />
          <meshStandardMaterial color="#6D4C41" roughness={0.7} />
        </mesh>
        {/* Incense sticks */}
        {[-0.01, 0.01, 0].map((dx, i) => (
          <mesh key={i} position={[dx, 0.18, dx * 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.28, 5]} />
            <meshStandardMaterial color="#8B6914" roughness={0.8} />
          </mesh>
        ))}
        {/* Smoke puff */}
        <mesh position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.035, 6, 6]} />
          <meshStandardMaterial color="#FFFFFF" transparent opacity={0.22} roughness={1} />
        </mesh>
      </group>

      {/* ── Ghanta (bell) on altar ─────────────────────────────────────── */}
      <group position={[-2.1, 0.54, -1.6]}>
        <mesh>
          <cylinderGeometry args={[0.065, 0.085, 0.12, 12]} />
          <meshStandardMaterial color="#DAA520" emissive="#8B6914" emissiveIntensity={0.4} roughness={0.35} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#DAA520" emissive="#8B6914" emissiveIntensity={0.5} roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* ── Marigold flower offering tray ─────────────────────────────── */}
      <mesh position={[0.4, 0.545, -1.5]}>
        <cylinderGeometry args={[0.12, 0.11, 0.02, 10]} />
        <meshStandardMaterial color="#C0A060" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Marigold petals (orange spheres) */}
      {[0, 0.08, 0.16, 0.24, 0.32, 0.40, 0.48, 0.56].map((angle, i) => (
        <mesh key={i} position={[
          0.4 + Math.sin(angle * Math.PI * 2) * 0.07,
          0.56,
          -1.5 + Math.cos(angle * Math.PI * 2) * 0.07,
        ]}>
          <sphereGeometry args={[0.025, 5, 5]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#FF8C00' : '#FFD700'} emissive="#FF6600" emissiveIntensity={0.3} roughness={0.7} />
        </mesh>
      ))}

      {/* ── Pooja rug / aasan ─────────────────────────────────────────── */}
      <mesh position={[0, 0.005, 0.5]} rotation={[-PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.5, 2.5]} />
        {mat('#8B0000', '#000', 0, 0.9)}
      </mesh>
      {/* Rug border pattern */}
      <mesh position={[0, 0.006, 0.5]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.5, 0.08]} />
        {mat('#DAA520', '#000', 0, 0.8)}
      </mesh>
      <mesh position={[0, 0.006, 1.7]} rotation={[-PI / 2, 0, 0]}>
        <planeGeometry args={[3.5, 0.08]} />
        {mat('#DAA520', '#000', 0, 0.8)}
      </mesh>

      {/* ── Warm glow point light for diya effect ─────────────────────── */}
      <pointLight position={[0, 0.8, -1.5]} intensity={0.9} color="#FF9020" distance={4} decay={2} />
    </group>
  );
}

// ── Porch / Verandah + Garage + Car (world coordinates, north side, z<-8) ──────
// Main entrance is on the north wall (z=-8). Porch extends north: z=[-14,-8].
// Garage is on the east side of porch.
export function PorchDecor() {
  return (
    <group raycast={() => null}>
      {/* ── Verandah / Porch floor — north side (z=-8 to z=-14) ──────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.5, 0.01, -11]} receiveShadow>
        <planeGeometry args={[15, 6]} />
        <meshStandardMaterial color="#B8A890" roughness={0.82} metalness={0.02} />
      </mesh>
      {/* Tile grout lines */}
      {[-2, -1, 0, 1, 2].map((dz, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-3.5, 0.015, -11 + dz * 1.0]}>
          <planeGeometry args={[15, 0.04]} />
          <meshStandardMaterial color="#8A7A6A" roughness={0.9} />
        </mesh>
      ))}
      {[-6, -4, -2, 0, 2, 4, 6].map((dx, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-3.5 + dx * 0.95, 0.015, -11]}>
          <planeGeometry args={[0.04, 6]} />
          <meshStandardMaterial color="#8A7A6A" roughness={0.9} />
        </mesh>
      ))}

      {/* Steps from house to porch */}
      <mesh position={[-7, 0.06, -8.35]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.12, 0.7]} />
        <meshStandardMaterial color="#C8B898" roughness={0.85} />
      </mesh>
      <mesh position={[-7, 0.03, -8.75]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.06, 0.7]} />
        <meshStandardMaterial color="#B8A888" roughness={0.85} />
      </mesh>

      {/* Verandah columns */}
      {[-9, -5].map((dx, i) => (
        <group key={i}>
          <mesh position={[dx, 0, -8.5]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.17, 3.0, 10]} />
            <meshStandardMaterial color="#D5C6B0" roughness={0.7} />
          </mesh>
          <mesh position={[dx, 1.55, -8.5]}>
            <boxGeometry args={[0.38, 0.1, 0.38]} />
            <meshStandardMaterial color="#C8B898" roughness={0.65} />
          </mesh>
          <mesh position={[dx, 0, -13.5]} castShadow receiveShadow>
            <cylinderGeometry args={[0.14, 0.17, 3.0, 10]} />
            <meshStandardMaterial color="#D5C6B0" roughness={0.7} />
          </mesh>
          <mesh position={[dx, 1.55, -13.5]}>
            <boxGeometry args={[0.38, 0.1, 0.38]} />
            <meshStandardMaterial color="#C8B898" roughness={0.65} />
          </mesh>
        </group>
      ))}
      {/* Verandah roof */}
      <mesh position={[-7, 3.06, -11]} castShadow>
        <boxGeometry args={[5.5, 0.16, 5.6]} />
        <meshStandardMaterial color="#7A6850" roughness={0.85} />
      </mesh>

      {/* Street lamp — by the entrance */}
      <group position={[-10, 0, -11]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.055, 0.075, 3.2, 8]} />
          <meshStandardMaterial color="#444" roughness={0.5} metalness={0.7} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.16, 10, 8]} />
          <meshStandardMaterial color="#FFF9E0" emissive="#FFE080" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        <pointLight position={[0, 1.7, 0]} intensity={1.5} color="#FFD580" distance={9} decay={2} />
      </group>

      {/* ── Pathway — stone slabs north from porch ────────────────────── */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-7, 0.005, -14.5 - i * 1.5]} receiveShadow>
          <boxGeometry args={[2.0, 1.2, 0.04]} />
          <meshStandardMaterial color="#A09080" roughness={0.9} />
        </mesh>
      ))}
      {/* Pathway grass border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7, 0.002, -22]}>
        <planeGeometry args={[12, 18]} />
        <meshStandardMaterial color="#3A6020" roughness={0.95} />
      </mesh>

      {/* ── Garage — east side (x[4,14], z[-8,-20]) ─────────────────── */}
      {/* Garage floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.01, -14]} receiveShadow>
        <planeGeometry args={[10, 12]} />
        <meshStandardMaterial color="#808080" roughness={0.9} />
      </mesh>
      {/* Garage south wall */}
      <mesh position={[9, 1.5, -8.07]} castShadow receiveShadow>
        <boxGeometry args={[10, 3, 0.14]} />
        <meshStandardMaterial color="#C8C0B0" roughness={0.85} />
      </mesh>
      {/* Garage door opening cutout — simple dark rect */}
      <mesh position={[9, 1.2, -8.0]}>
        <boxGeometry args={[4.2, 2.4, 0.16]} />
        <meshStandardMaterial color="#1A1A1A" roughness={1.0} />
      </mesh>
      {/* Garage door panels (rolled-up style) */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[9, 2.55 - i * 0.07, -7.95]}>
          <boxGeometry args={[4.1, 0.06, 0.04]} />
          <meshStandardMaterial color="#8090A0" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* Garage west wall */}
      <mesh position={[4.07, 1.5, -14]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 3, 12]} />
        <meshStandardMaterial color="#C8C0B0" roughness={0.85} />
      </mesh>
      {/* Garage east wall */}
      <mesh position={[13.93, 1.5, -14]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 3, 12]} />
        <meshStandardMaterial color="#C8C0B0" roughness={0.85} />
      </mesh>
      {/* Garage north wall */}
      <mesh position={[9, 1.5, -19.93]} castShadow receiveShadow>
        <boxGeometry args={[10, 3, 0.14]} />
        <meshStandardMaterial color="#B8B0A0" roughness={0.85} />
      </mesh>
      {/* Garage roof */}
      <mesh position={[9, 3.05, -14]} castShadow>
        <boxGeometry args={[10.3, 0.16, 12.3]} />
        <meshStandardMaterial color="#7A7060" roughness={0.88} />
      </mesh>
      {/* Garage interior light */}
      <pointLight position={[9, 2.6, -14]} intensity={0.8} color="#FFE8C0" distance={10} decay={2} />

      {/* ── Car — parked inside garage ────────────────────────────────── */}
      <group position={[9, 0, -14.5]}>
        {/* Car body */}
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[2.0, 0.72, 4.2]} />
          <meshStandardMaterial color="#C0392B" roughness={0.3} metalness={0.6} />
        </mesh>
        {/* Car roof / cabin */}
        <mesh position={[0.05, 0.95, -0.3]} castShadow>
          <boxGeometry args={[1.72, 0.52, 2.4]} />
          <meshStandardMaterial color="#C0392B" roughness={0.3} metalness={0.6} />
        </mesh>
        {/* Windshield */}
        <mesh position={[0, 1.0, 0.88]}>
          <boxGeometry args={[1.6, 0.44, 0.04]} />
          <meshStandardMaterial color="#A0C8E0" transparent opacity={0.55} roughness={0.05} metalness={0.1} />
        </mesh>
        {/* Rear window */}
        <mesh position={[0, 1.0, -1.48]}>
          <boxGeometry args={[1.6, 0.36, 0.04]} />
          <meshStandardMaterial color="#A0C8E0" transparent opacity={0.55} roughness={0.05} metalness={0.1} />
        </mesh>
        {/* Wheels — 4 cylinders */}
        {[[-0.92, 0.25, 1.4], [0.92, 0.25, 1.4], [-0.92, 0.25, -1.4], [0.92, 0.25, -1.4]].map(([wx, wy, wz], i) => (
          <mesh key={i} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.22, 14]} />
            <meshStandardMaterial color="#1A1A1A" roughness={0.9} />
          </mesh>
        ))}
        {/* Wheel rims */}
        {[[-0.92, 0.25, 1.4], [0.92, 0.25, 1.4], [-0.92, 0.25, -1.4], [0.92, 0.25, -1.4]].map(([wx, wy, wz], i) => (
          <mesh key={i} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.23, 10]} />
            <meshStandardMaterial color="#C0C0C0" roughness={0.3} metalness={0.8} />
          </mesh>
        ))}
        {/* Headlights */}
        <mesh position={[-0.65, 0.5, 2.12]}>
          <boxGeometry args={[0.32, 0.16, 0.04]} />
          <meshStandardMaterial color="#FFFDE0" emissive="#FFFF80" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0.65, 0.5, 2.12]}>
          <boxGeometry args={[0.32, 0.16, 0.04]} />
          <meshStandardMaterial color="#FFFDE0" emissive="#FFFF80" emissiveIntensity={0.4} />
        </mesh>
        {/* Tail lights */}
        <mesh position={[-0.65, 0.5, -2.12]}>
          <boxGeometry args={[0.32, 0.14, 0.04]} />
          <meshStandardMaterial color="#FF3020" emissive="#FF2000" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0.65, 0.5, -2.12]}>
          <boxGeometry args={[0.32, 0.14, 0.04]} />
          <meshStandardMaterial color="#FF3020" emissive="#FF2000" emissiveIntensity={0.6} />
        </mesh>
        {/* Number plate */}
        <mesh position={[0, 0.38, 2.13]}>
          <boxGeometry args={[0.5, 0.14, 0.02]} />
          <meshStandardMaterial color="#F5F5DC" roughness={0.5} />
        </mesh>
      </group>

      {/* Garage driveway path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[9, 0.005, -6.5]} receiveShadow>
        <planeGeometry args={[4.5, 3]} />
        <meshStandardMaterial color="#707070" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Legacy HouseDecor wrapper (No longer draws room decor here, now drawn by RoomMesh)
export function HouseDecor() {
  return (
    <group>
      <Windows />
      <PorchDecor />
    </group>
  );
}
