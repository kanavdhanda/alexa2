import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Premium PBR standard material creator
function mat(color: string, roughness = 0.72, metalness = 0.05, emissive?: string, emissiveIntensity = 0) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

// ── Overhauled High-Fidelity Furniture Geometries ─────────────────────────────

export function SofaGeometry() {
  const fabric = '#E8E6E0'; // light cream linen fabric
  const cushionColor = '#FAF9F6'; // soft off-white cushions
  const pillowColor = '#7A8B99'; // pastel blue-grey pillows
  const legColor = '#2F1F17'; // dark walnut wood legs

  return (
    <group>
      {/* Sleek dark wood base frame */}
      <mesh position={[0, 0.08, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.82, 0.08, 0.74]} />
        {mat(legColor, 0.6, 0.1)}
      </mesh>

      {/* Sofa legs (walnut pegs) */}
      {[[-0.84, -0.32], [-0.84, 0.32], [0.84, -0.32], [0.84, 0.32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.04, z + 0.05]} castShadow>
          <cylinderGeometry args={[0.03, 0.02, 0.08, 12]} />
          {mat(legColor, 0.5, 0.1)}
        </mesh>
      ))}

      {/* Main bottom frame */}
      <mesh position={[0, 0.22, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.82, 0.2, 0.74]} />
        {mat(fabric, 0.85)}
      </mesh>

      {/* Comfortable seat cushions */}
      {[-0.45, 0.45].map((x, i) => (
        <mesh key={i} position={[x, 0.36, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.12, 0.58]} />
          {mat(cushionColor, 0.95)}
        </mesh>
      ))}

      {/* Fluffy backrest cushions */}
      {[-0.45, 0.45].map((x, i) => (
        <mesh key={i} position={[x, 0.58, -0.18]} castShadow>
          <boxGeometry args={[0.82, 0.42, 0.16]} />
          {mat(cushionColor, 0.95)}
        </mesh>
      ))}

      {/* Left armrest */}
      <mesh position={[-0.87, 0.44, 0.05]} castShadow>
        <boxGeometry args={[0.12, 0.4, 0.74]} />
        {mat(fabric, 0.85)}
      </mesh>

      {/* Right armrest */}
      <mesh position={[0.87, 0.44, 0.05]} castShadow>
        <boxGeometry args={[0.12, 0.4, 0.74]} />
        {mat(fabric, 0.85)}
      </mesh>

      {/* Stylish throw pillows */}
      <mesh position={[-0.72, 0.46, 0.1]} rotation={[0.2, 0.3, -0.15]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.12]} />
        {mat(pillowColor, 0.9)}
      </mesh>
      <mesh position={[0.72, 0.46, 0.1]} rotation={[0.2, -0.3, 0.15]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.12]} />
        {mat(pillowColor, 0.9)}
      </mesh>
    </group>
  );
}

export function BedGeometry() {
  const frameColor = '#2C3539'; // charcoal upholstered frame
  const woodColor = '#C19A6B'; // natural oak headboard frame
  const sheetColor = '#FFFFFF'; // clean white bedsheets
  const blanketColor = '#5C768D'; // dusty blue duvet
  const pillowAccent = '#D9A05B'; // mustard yellow pillow

  return (
    <group>
      {/* Oak Headboard frame */}
      <mesh position={[0, 0.62, -1.02]} castShadow>
        <boxGeometry args={[1.72, 0.74, 0.08]} />
        {mat(woodColor, 0.65)}
      </mesh>
      {/* Tufted Headboard Fabric Panel */}
      <mesh position={[0, 0.65, -0.96]} castShadow>
        <boxGeometry args={[1.56, 0.58, 0.06]} />
        {mat(frameColor, 0.85)}
      </mesh>

      {/* Upholstered Bed Frame Side Rails */}
      <mesh position={[0, 0.16, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.66, 0.24, 2.04]} />
        {mat(frameColor, 0.85)}
      </mesh>
      {/* Low Footboard */}
      <mesh position={[0, 0.22, 1.08]} castShadow>
        <boxGeometry args={[1.66, 0.28, 0.08]} />
        {mat(frameColor, 0.85)}
      </mesh>

      {/* Thick Comfortable Mattress */}
      <mesh position={[0, 0.36, 0.04]} castShadow>
        <boxGeometry args={[1.52, 0.22, 1.94]} />
        {mat(sheetColor, 0.92)}
      </mesh>

      {/* Stacked Pillows (Pillow 1 Left) */}
      <mesh position={[-0.38, 0.50, -0.66]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.56, 0.08, 0.36]} />
        {mat(sheetColor, 0.9)}
      </mesh>
      {/* Pillow 1 Right */}
      <mesh position={[0.38, 0.50, -0.66]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.56, 0.08, 0.36]} />
        {mat(sheetColor, 0.9)}
      </mesh>
      {/* Accent Pillow Left */}
      <mesh position={[-0.38, 0.54, -0.52]} rotation={[0.22, 0.05, 0.04]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.28]} />
        {mat(pillowAccent, 0.92)}
      </mesh>
      {/* Accent Pillow Right */}
      <mesh position={[0.38, 0.54, -0.52]} rotation={[0.22, -0.05, -0.04]} castShadow>
        <boxGeometry args={[0.42, 0.08, 0.28]} />
        {mat(frameColor, 0.92)}
      </mesh>

      {/* Premium Folded Duvet */}
      <mesh position={[0, 0.49, 0.24]} castShadow>
        <boxGeometry args={[1.56, 0.08, 1.32]} />
        {mat(blanketColor, 0.88)}
      </mesh>
    </group>
  );
}

export function TableGeometry() {
  const marbleColor = '#FAF8F5'; // premium round white marble top
  const brassColor = '#D4AF37'; // golden brass legs

  return (
    <group>
      {/* Circular Marble Tabletop */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.54, 0.54, 0.04, 32]} />
        {mat(marbleColor, 0.15, 0.1)}
      </mesh>

      {/* Crossed Geometric Metal Base */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.72, 8]} />
        {mat(brassColor, 0.25, 0.85)}
      </mesh>
      {/* Feet extensions */}
      {[-0.32, 0.32].map((x, i) => (
        <mesh key={i} position={[x, 0.015, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.68, 8]} />
          {mat(brassColor, 0.25, 0.85)}
        </mesh>
      ))}
      {[-0.32, 0.32].map((z, i) => (
        <mesh key={i} position={[0, 0.015, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.68, 8]} />
          {mat(brassColor, 0.25, 0.85)}
        </mesh>
      ))}
    </group>
  );
}

export function ChairGeometry() {
  const shellColor = '#3A3A3D'; // dark charcoal molded chair shell
  const woodColor = '#D0A070'; // light oak dowel legs
  const metalColor = '#1A1A1C'; // black steel wire struts

  return (
    <group>
      {/* Molded Plastic Bucket Seat */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.46, 0.06, 0.44]} />
        {mat(shellColor, 0.65)}
      </mesh>
      {/* Ergonomic Curved Back */}
      <mesh position={[0, 0.66, -0.19]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.44, 0.04]} />
        {mat(shellColor, 0.65)}
      </mesh>

      {/* Black Wire Frame Support under Seat */}
      <mesh position={[0, 0.39, 0]} castShadow>
        <boxGeometry args={[0.3, 0.04, 0.3]} />
        {mat(metalColor, 0.3, 0.9)}
      </mesh>

      {/* Mid-Century Modern Wooden Dowel Legs (Angled out) */}
      {[
        [-0.16, 0.2, -0.16, 0.15, -0.15],
        [-0.16, 0.2, 0.16, -0.15, -0.15],
        [0.16, 0.2, -0.16, 0.15, 0.15],
        [0.16, 0.2, 0.16, -0.15, 0.15],
      ].map(([x, y, z, rx, rz], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[rx, 0, rz]} castShadow>
          <cylinderGeometry args={[0.018, 0.012, 0.42, 8]} />
          {mat(woodColor, 0.68)}
        </mesh>
      ))}
    </group>
  );
}

export function TVStandGeometry() {
  const oakColor = '#CBA070'; // natural oak body
  const frontColor = '#FDFDFD'; // clean white matte doors
  const glassColor = '#B0C4DE'; // smoked glass shelves

  return (
    <group>
      {/* Oak outer frame cabinet */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.56, 0.46, 0.44]} />
        {mat(oakColor, 0.72)}
      </mesh>

      {/* Hollow inner compartments / Sliding door panels */}
      <mesh position={[-0.38, 0.25, 0.21]} castShadow>
        <boxGeometry args={[0.68, 0.38, 0.03]} />
        {mat(frontColor, 0.85)}
      </mesh>
      {/* Aluminum handles */}
      <mesh position={[-0.14, 0.25, 0.23]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        {mat('#CCCCCC', 0.2, 0.85)}
      </mesh>

      {/* Open Media Console bay with Smoked Glass Shelf */}
      <mesh position={[0.38, 0.25, 0.02]} castShadow>
        <boxGeometry args={[0.68, 0.015, 0.38]} />
        <meshStandardMaterial color={glassColor} transparent opacity={0.65} roughness={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Cable pass-through slots */}
      <mesh position={[0.38, 0.25, -0.21]}>
        <boxGeometry args={[0.12, 0.08, 0.01]} />
        {mat('#1A1A1A')}
      </mesh>

      {/* Minimalist matte black metal legs */}
      {[[-0.72, 0.04, -0.16], [-0.72, 0.04, 0.16], [0.72, 0.04, -0.16], [0.72, 0.04, 0.16]].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[0.03, 0.08, 0.03]} />
          {mat('#1F1F21', 0.4, 0.85)}
        </mesh>
      ))}
    </group>
  );
}

export function BookshelfGeometry() {
  const walnutColor = '#5B4030';
  const ornamentColor = '#D4AF37';
  const bookColors = ['#A83232', '#2A6F97', '#3F7D20', '#6A4C93', '#F18F01', '#01A7C2', '#C64F9F', '#3A3A3D'];

  return (
    <group>
      {/* Asymmetric Walnut wood upright frame */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.88, 1.82, 0.32]} />
        {mat(walnutColor, 0.72)}
      </mesh>
      {/* Dark back panel */}
      <mesh position={[0, 0.9, -0.14]}>
        <boxGeometry args={[0.82, 1.76, 0.02]} />
        {mat('#2B1A10', 0.9)}
      </mesh>

      {/* Off-center shelves */}
      {[0.24, 0.62, 1.0, 1.38, 1.68].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[0.84, 0.04, 0.3]} />
          {mat(walnutColor, 0.72)}
        </mesh>
      ))}

      {/* Detailed book bundles in realistic tilted stacks */}
      {[0.4, 1.16].map((y, si) => (
        Array.from({ length: 5 }).map((_, bi) => {
          const bw = 0.07 + Math.random() * 0.02;
          const bh = 0.16 + Math.random() * 0.08;
          return (
            <mesh key={`b-${si}-${bi}`} position={[-0.3 + bi * 0.11, y + bh / 2, -0.01]} castShadow>
              <boxGeometry args={[bw, bh, 0.22]} />
              {mat(bookColors[(si * 5 + bi) % bookColors.length], 0.9)}
            </mesh>
          );
        })
      ))}

      {/* Modern ceramic vases / golden trophies on open shelves */}
      <mesh position={[0.22, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, 0.24, 12]} />
        {mat('#FFFFFF', 0.15)} {/* White Glossy Ceramic */}
      </mesh>
      <mesh position={[-0.22, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.08, 12, 12]} />
        {mat(ornamentColor, 0.2, 0.85)} {/* Metallic Gold Sphere */}
      </mesh>
    </group>
  );
}

export function BathtubGeometry() {
  const chromeColor = '#E6E6E6';
  return (
    <group>
      {/* Sleek freestanding oval tub body */}
      <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.52, 1.68]} />
        {mat('#FCFCFC', 0.18, 0.05)}
      </mesh>
      {/* Curved hollow interior basin */}
      <mesh position={[0, 0.38, 0.02]}>
        <boxGeometry args={[0.66, 0.28, 1.48]} />
        {mat('#F2F8FA', 0.12, 0.02)}
      </mesh>

      {/* Floating water surface when active */}
      <mesh position={[0, 0.46, 0.02]}>
        <boxGeometry args={[0.64, 0.01, 1.46]} />
        <meshStandardMaterial color="#4A90E2" transparent opacity={0.6} roughness={0.05} metalness={0.1} />
      </mesh>

      {/* Premium wall-adjacent tall Chrome gooseneck faucet */}
      <group position={[0, 0.42, -0.72]}>
        <mesh position={[0, 0.24, 0]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, 0.48, 8]} />
          {mat(chromeColor, 0.1, 0.95)}
        </mesh>
        <mesh position={[0, 0.48, 0.06]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.14, 8]} />
          {mat(chromeColor, 0.1, 0.95)}
        </mesh>
      </group>
    </group>
  );
}

export function DeskGeometry() {
  const oakColor = '#DCC8A0';
  const aluminumColor = '#CCCCCC';

  return (
    <group>
      {/* Natural Oak tabletop */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.42, 0.05, 0.72]} />
        {mat(oakColor, 0.7)}
      </mesh>

      {/* Sleek black steel hairpin-style leg frames */}
      {[[-0.66, -0.32], [-0.66, 0.32], [0.66, -0.32], [0.66, 0.32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]} castShadow>
          <cylinderGeometry args={[0.016, 0.016, 0.74, 8]} />
          {mat('#1F1F21', 0.3, 0.85)}
        </mesh>
      ))}

      {/* Desk drawers unit on the side */}
      <mesh position={[0.44, 0.36, 0.04]} castShadow>
        <boxGeometry args={[0.34, 0.44, 0.54]} />
        {mat('#ECEFF1', 0.85)}
      </mesh>
      <mesh position={[0.44, 0.46, 0.312]}>
        <boxGeometry args={[0.28, 0.14, 0.01]} />
        {mat(oakColor, 0.7)}
      </mesh>

      {/* Curved ultra-wide workspace monitor */}
      <group position={[0, 0.765, -0.16]}>
        {/* Stand */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
          {mat(aluminumColor, 0.15, 0.9)}
        </mesh>
        {/* Base */}
        <mesh position={[0, 0.005, 0.04]}>
          <boxGeometry args={[0.16, 0.01, 0.12]} />
          {mat(aluminumColor, 0.15, 0.9)}
        </mesh>
        {/* Curving Display screen */}
        <mesh position={[0, 0.28, -0.04]} rotation={[0.08, 0, 0]} castShadow>
          <boxGeometry args={[0.68, 0.28, 0.03]} />
          {mat('#151515', 0.25, 0.25)}
        </mesh>
        {/* Glowing Screen face */}
        <mesh position={[0, 0.28, -0.024]} rotation={[0.08, 0, 0]}>
          <boxGeometry args={[0.66, 0.26, 0.001]} />
          {mat('#080812', 0.08, 0.1, '#0C0C1F', 0.3)}
        </mesh>
      </group>

      {/* Ceramic coffee mug and keyboard layout */}
      <mesh position={[-0.36, 0.78, 0.08]}>
        <cylinderGeometry args={[0.035, 0.035, 0.07, 10]} />
        {mat('#C62828', 0.2)} {/* Red Mug */}
      </mesh>
      <mesh position={[0, 0.77, 0.14]}>
        <boxGeometry args={[0.34, 0.01, 0.12]} />
        {mat('#1A1A1D', 0.4)} {/* Keyboard */}
      </mesh>
    </group>
  );
}

export function PlantGeometry() {
  const greenColor = '#2D6A4F';

  return (
    <group>
      {/* Matte terracotta planter pot */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.11, 0.3, 16]} />
        {mat('#D67D5A', 0.85)}
      </mesh>
      {/* Dark organic soil */}
      <mesh position={[0, 0.292, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.016, 16]} />
        {mat('#382212', 0.95)}
      </mesh>

      {/* Hand-modeled split-leaf Monstera plant stalks */}
      {[
        [0, 0.44, 0, 0.12, 0.12],
        [0.08, 0.54, 0.06, 0.28, 0.35],
        [-0.08, 0.52, -0.06, -0.22, -0.32],
      ].map(([x, y, z, rx, rz], i) => (
        <group key={i} position={[x, y, z]} rotation={[rx, 0, rz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.008, 0.012, 0.34, 6]} />
            {mat('#4B8B3B', 0.8)}
          </mesh>
          {/* Fan leaf nodes */}
          <mesh position={[0, 0.18, 0]} rotation={[0.4, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.16, 8, 8]} />
            {mat(greenColor, 0.88)}
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function WardrobeGeometry() {
  const timber = '#D0A070';
  const lacquer = '#FAFAFA'; // glossy white lacquer front

  return (
    <group>
      {/* Heavy wood tall cabinet box */}
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.22, 2.02, 0.56]} />
        {mat(timber, 0.7)}
      </mesh>

      {/* Double wardrobe doors in white finish */}
      <mesh position={[-0.295, 1.0, 0.29]} castShadow>
        <boxGeometry args={[0.56, 1.94, 0.03]} />
        {mat(lacquer, 0.3)}
      </mesh>
      <mesh position={[0.295, 1.0, 0.29]} castShadow>
        <boxGeometry args={[0.56, 1.94, 0.03]} />
        {mat(lacquer, 0.3)}
      </mesh>

      {/* Sleek integrated wood groove handles */}
      <mesh position={[-0.04, 1.0, 0.32]}>
        <boxGeometry args={[0.02, 0.28, 0.04]} />
        {mat(timber, 0.65)}
      </mesh>
      <mesh position={[0.04, 1.0, 0.32]}>
        <boxGeometry args={[0.02, 0.28, 0.04]} />
        {mat(timber, 0.65)}
      </mesh>

      {/* Modern top header molding */}
      <mesh position={[0, 2.03, 0.01]}>
        <boxGeometry args={[1.26, 0.06, 0.6]} />
        {mat('#2B2B2D', 0.85)}
      </mesh>
    </group>
  );
}

// ── Overhauled High-Fidelity Alexa Device Geometries ──────────────────────────

export function EchoDotGeometry({ isOn }: { isOn: boolean }) {
  const meshColor = '#3A3A3D'; // charcoal fabric cover
  return (
    <group>
      {/* Spherical Fabric Speaker Cover (Echo Dot 4th/5th Gen design) */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <sphereGeometry args={[0.14, 24, 20]} />
        {mat(meshColor, 0.95)}
      </mesh>

      {/* Flat non-slip rubber base */}
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 16]} />
        {mat('#1A1A1C')}
      </mesh>

      {/* Alexa light ring on top panel */}
      <mesh position={[0, 0.085, 0]}>
        <torusGeometry args={[0.09, 0.008, 8, 28]} />
        {mat(isOn ? '#00CAFF' : '#2A2A2D', 0.1, 0.2, isOn ? '#0090FF' : '#000', isOn ? 1.5 : 0)}
      </mesh>

      {/* Matte control button row (+, -, mute, action) */}
      {[-0.04, -0.015, 0.015, 0.04].map((zOffset, i) => (
        <mesh key={i} position={[0, 0.142, zOffset]}>
          <sphereGeometry args={[0.008, 6, 6]} />
          {mat('#2A2A2D')}
        </mesh>
      ))}
    </group>
  );
}

export function EchoShowGeometry({ isOn }: { isOn: boolean }) {
  const screenBorder = '#111112';
  const fabricColor = '#3C3C3F';

  return (
    <group>
      {/* Weighted cylindrical fabric speaker base */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.12, 20]} />
        {mat(fabricColor, 0.95)}
      </mesh>

      {/* Screen panel assembly tilted back */}
      <group position={[0, 0.16, -0.02]} rotation={[0.28, 0, 0]}>
        {/* Rear screen housing cover */}
        <mesh castShadow>
          <boxGeometry args={[0.48, 0.32, 0.04]} />
          {mat('#2B2B2D', 0.5, 0.2)}
        </mesh>
        {/* Sleek black glass front bezel */}
        <mesh position={[0, 0, 0.022]}>
          <boxGeometry args={[0.5, 0.34, 0.005]} />
          {mat(screenBorder, 0.1, 0.2)}
        </mesh>
        {/* High-res smart display panel */}
        <mesh position={[0, 0, 0.026]}>
          <boxGeometry args={[0.45, 0.29, 0.001]} />
          {mat(isOn ? '#0A1828' : '#09090A', 0.08, 0.1, isOn ? '#103866' : '#000000', isOn ? 0.6 : 0)}
        </mesh>
        {/* Front-facing camera dot */}
        <mesh position={[0.21, 0.13, 0.028]}>
          <sphereGeometry args={[0.006, 6, 6]} />
          {mat('#000000', 0.01, 0.95)}
        </mesh>
      </group>
    </group>
  );
}

export function SmartBulbGeometry({ isOn, color }: { isOn: boolean; color: string }) {
  const metallicColor = '#D4AF37'; // brass cord fixture

  return (
    <group>
      {/* Black fabric hanging electrical cord */}
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.32, 6]} />
        {mat('#1A1A1A', 0.9, 0.0)}
      </mesh>
      
      {/* Geometric brass socket cap */}
      <mesh position={[0, -0.34, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.08, 8]} />
        {mat(metallicColor, 0.2, 0.85)}
      </mesh>

      {/* Transparent glass lightbulb bulb profile */}
      <mesh position={[0, -0.46, 0]} castShadow>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshStandardMaterial
          color={isOn ? color : '#E2E8F0'}
          emissive={isOn ? color : '#000000'}
          emissiveIntensity={isOn ? 2.5 : 0}
          transparent
          opacity={isOn ? 0.85 : 0.65}
          roughness={0.05}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glowing filament wire inside the bulb (Only visible when active) */}
      {isOn && (
        <mesh position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.04, 6]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
}

export function ThermostatGeometry({ isOn }: { isOn: boolean }) {
  const border = '#ECEFF1';
  return (
    <group>
      {/* Minimal square wall mount backing plate */}
      <mesh position={[0, 0.14, -0.015]}>
        <boxGeometry args={[0.26, 0.26, 0.03]} />
        {mat(border, 0.3)}
      </mesh>

      {/* Glossy round glass outer bezel ring */}
      <mesh position={[0, 0.14, 0.015]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 32]} />
        {mat('#222224', 0.1, 0.85)}
      </mesh>

      {/* Animated glowing status LED ring */}
      <mesh position={[0, 0.14, 0.038]}>
        <torusGeometry args={[0.095, 0.006, 8, 32]} />
        {mat(isOn ? '#00FF44' : '#555558', 0.2, 0.2, isOn ? '#00E844' : '#000', isOn ? 1.0 : 0)}
      </mesh>

      {/* Digital Thermometer display face */}
      <mesh position={[0, 0.14, 0.036]}>
        <cylinderGeometry args={[0.07, 0.07, 0.002, 32]} />
        {mat(isOn ? '#0F1A12' : '#060608', 0.05)}
      </mesh>
    </group>
  );
}

export function SmartPlugGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Solid smooth plastic plug base */}
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.09, 0.13, 0.065]} />
        {mat('#FCFCFC', 0.25, 0.02)}
      </mesh>

      {/* Golden metallic brass contact prongs */}
      {[-0.02, 0.02].map((x, i) => (
        <mesh key={i} position={[x, -0.02, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.04, 8]} />
          {mat('#C0A040', 0.2, 0.75)}
        </mesh>
      ))}

      {/* Small status light dot */}
      <mesh position={[0, 0.1, 0.034]}>
        <sphereGeometry args={[0.008, 6, 6]} />
        {mat(isOn ? '#00FF33' : '#3C3C40', 0.15, 0, isOn ? '#00FF33' : '#000', isOn ? 2.5 : 0)}
      </mesh>
    </group>
  );
}

export function MotionSensorGeometry({ isOn, motionDetected }: { isOn: boolean; motionDetected?: boolean }) {
  return (
    <group>
      {/* Glossy round sensor chassis */}
      <mesh position={[0, 0.075, 0]} castShadow>
        <boxGeometry args={[0.13, 0.13, 0.075]} />
        {mat('#FAFAFA', 0.3)}
      </mesh>

      {/* Translucent PIR dome detector lens */}
      <mesh position={[0, 0.08, 0.039]}>
        <sphereGeometry args={[0.048, 12, 10]} />
        {mat(isOn ? (motionDetected ? '#FF2200' : '#0088FF') : '#7C8C99', 0.18, 0.1,
           isOn ? (motionDetected ? '#FF1100' : '#0044EE') : '#000',
           isOn ? (motionDetected ? 1.6 : 0.4) : 0)}
      </mesh>
    </group>
  );
}

export function SmartLockGeometry({ isLocked }: { isOn: boolean; isLocked?: boolean }) {
  const metalColor = '#3A3A3C'; // matte charcoal metal housing
  return (
    <group>
      {/* Security lock housing */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.09, 0.23, 0.045]} />
        {mat(metalColor, 0.32, 0.45)}
      </mesh>

      {/* Keypad touch buttons grid */}
      {[[-0.018, 0.16], [0.018, 0.16], [-0.018, 0.11], [0.018, 0.11], [-0.018, 0.06], [0.018, 0.06]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.024]}>
          <cylinderGeometry args={[0.007, 0.007, 0.005, 6]} />
          {mat('#555558')}
        </mesh>
      ))}

      {/* LED Security lock active dot (Green for locked, red for open) */}
      <mesh position={[0, 0.20, 0.024]}>
        <sphereGeometry args={[0.008, 6, 6]} />
        {mat(isLocked ? '#00FF44' : '#FF2200', 0.15, 0, isLocked ? '#00FF44' : '#FF2200', 2.0)}
      </mesh>
    </group>
  );
}

export function CameraGeometry({ isOn }: { isOn: boolean }) {
  const casing = '#FAFAFA'; // clean white camera housing
  return (
    <group>
      {/* Weighted rounded mounting stand base */}
      <mesh position={[0, 0.015, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.09, 0.03, 16]} />
        {mat(casing, 0.3)}
      </mesh>
      {/* Pivot mount rod */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.06, 8]} />
        {mat('#CCCCCC', 0.15, 0.85)}
      </mesh>

      {/* Bullet/Puck style smart camera head */}
      <mesh position={[0, 0.13, 0]} castShadow>
        <sphereGeometry args={[0.095, 18, 16]} />
        {mat(casing, 0.3)}
      </mesh>

      {/* Front camera lens glass cover */}
      <mesh position={[0, 0.13, 0.066]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.054, 0.054, 0.012, 16]} />
        {mat('#1A1A1C', 0.08, 0.45)}
      </mesh>
      {/* Camera lens optical glass */}
      <mesh position={[0, 0.13, 0.073]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.004, 16]} />
        {mat('#05050C', 0.02, 0.15, isOn ? '#0066FF' : '#000000', isOn ? 0.6 : 0)}
      </mesh>

      {/* Active Recording red LED */}
      <mesh position={[-0.03, 0.17, 0.064]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        {mat(isOn ? '#FF0000' : '#1A0000', 0.1, 0, isOn ? '#FF0000' : '#000', isOn ? 1.0 : 0)}
      </mesh>
    </group>
  );
}

export function SmokeDetectorGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Ceiling flat smoke alert puck */}
      <mesh position={[0, 0.036, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.06, 24]} />
        {mat('#FCFCFC', 0.3)}
      </mesh>
      
      {/* Center testing button */}
      <mesh position={[0, 0.067, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.005, 12]} />
        {mat('#F2F2F2')}
      </mesh>

      {/* Status blink LED */}
      <mesh position={[0.07, 0.067, 0.07]}>
        <sphereGeometry args={[0.008, 8, 6]} />
        {mat(isOn ? '#00FF33' : '#2C2C30', 0.15, 0, isOn ? '#00FF33' : '#000', isOn ? 1.2 : 0)}
      </mesh>

      {/* Perimeter air intakes */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.09, 0.067, Math.sin(angle) * 0.09]}>
            <boxGeometry args={[0.012, 0.004, 0.024]} />
            {mat('#E0E0E0')}
          </mesh>
        );
      })}
    </group>
  );
}

export function SmartTVGeometry({ isOn }: { isOn: boolean }) {
  const screenRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!screenRef.current || !isOn) return;
    const t = clock.getElapsedTime();
    // Soft TV glow pulse
    screenRef.current.emissiveIntensity = 0.55 + Math.sin(t * 1.6) * 0.08;
  });

  return (
    <group>
      {/* Ultra thin flat screen body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.42, 0.84, 0.04]} />
        {mat('#151516', 0.28, 0.25)}
      </mesh>

      {/* Glowing screen face (Animated active interface) */}
      <mesh position={[0, 0.5, 0.021]}>
        <boxGeometry args={[1.36, 0.78, 0.001]} />
        <meshStandardMaterial
          ref={screenRef}
          color={isOn ? '#041B44' : '#08080A'}
          emissive={isOn ? '#1052B8' : '#000000'}
          emissiveIntensity={isOn ? 0.6 : 0}
          roughness={0.06}
          metalness={0.15}
        />
      </mesh>

      {/* Sleek thin aluminum bezel */}
      <mesh position={[0, 0.5, 0.022]}>
        <boxGeometry args={[1.38, 0.8, 0.001]} />
        {mat('#1F1F21', 0.3)}
      </mesh>

      {/* Curved metal support neck */}
      <mesh position={[0, 0.05, 0.01]}>
        <boxGeometry args={[0.06, 0.12, 0.04]} />
        {mat('#CCCCCC', 0.15, 0.85)}
      </mesh>
      {/* Heavy metal table stand foot */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.38, 0.024, 0.16]} />
        {mat('#CCCCCC', 0.15, 0.85)}
      </mesh>
    </group>
  );
}

export function CeilingFanGeometry({ isOn, speed = 1 }: { isOn: boolean; speed?: number }) {
  const bladesRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!bladesRef.current) return;
    if (isOn) {
      bladesRef.current.rotation.y += delta * speed * 5.2;
    } else if (Math.abs(bladesRef.current.rotation.y % (Math.PI * 2)) > 0.01) {
      bladesRef.current.rotation.y += delta * 0.65;
    }
  });

  return (
    <group>
      {/* Matte black drop rod */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
        {mat('#1F1F21', 0.35, 0.45)}
      </mesh>

      {/* Smooth dome motor housing */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.1, 16]} />
        {mat('#2A2A2D', 0.3, 0.45)}
      </mesh>

      {/* Dynamic angled fan blades */}
      <group ref={bladesRef}>
        {[0, 120, 240].map((deg, i) => (
          <group key={i} rotation={[0, deg * Math.PI / 180, 0]}>
            <mesh position={[0.3, 0.01, 0]} rotation={[0.06, 0, 0]} castShadow>
              <boxGeometry args={[0.48, 0.014, 0.1]} />
              {mat('#3A2A1E', 0.85)} {/* Teak wood blades */}
            </mesh>
          </group>
        ))}
      </group>

      {/* Center light bowl cover */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.054, 0.036, 0.06, 12]} />
        {mat('#ECEFF1', 0.12, 0.1, isOn ? '#FFFDDC' : '#000000', isOn ? 1.0 : 0)}
      </mesh>
    </group>
  );
}

export function DoorbellGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Modern vertical glass doorbell plate */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.075, 0.18, 0.03]} />
        {mat('#2A2A2F', 0.2, 0.35)}
      </mesh>
      
      {/* Curved camera optic lens dome */}
      <mesh position={[0, 0.13, 0.018]}>
        <cylinderGeometry args={[0.018, 0.018, 0.015, 12]} />
        {mat('#05050A', 0.05, 0.85)}
      </mesh>

      {/* Circular tactile chime button */}
      <mesh position={[0, 0.04, 0.018]}>
        <cylinderGeometry args={[0.016, 0.016, 0.006, 12]} />
        {mat('#FFFFFF', 0.1)}
      </mesh>
      {/* Glowing ring around the chime button */}
      <mesh position={[0, 0.04, 0.018]}>
        <torusGeometry args={[0.02, 0.003, 6, 20]} />
        {mat(isOn ? '#00CAFF' : '#555558', 0.1, 0.2, isOn ? '#00CAFF' : '#000', isOn ? 1.2 : 0)}
      </mesh>
    </group>
  );
}

export function AirPurifierGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Matte white cylindrical air intake chassis */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.14, 0.6, 20]} />
        {mat('#FCFCFC', 0.3)}
      </mesh>

      {/* Sleek top fan output grill */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.124, 0.124, 0.016, 20]} />
        {mat('#2B2B2D', 0.4)}
      </mesh>

      {/* Glowing status circle indicator */}
      <mesh position={[0, 0.44, 0.132]}>
        <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
        {mat(isOn ? '#00E676' : '#546E7A', 0.1, 0.2, isOn ? '#00C853' : '#000', isOn ? 1.0 : 0)}
      </mesh>

      {/* Black capacitive screen panel */}
      <mesh position={[0, 0.26, 0.136]}>
        <boxGeometry args={[0.08, 0.11, 0.008]} />
        {mat('#1E1E21', 0.15)}
      </mesh>
    </group>
  );
}

// ── Indian Context Device Geometries ─────────────────────────────────────────

export function GeyserGeometry({ isOn }: { isOn: boolean }) {
  const tankRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!tankRef.current || !isOn) return;
    tankRef.current.emissiveIntensity = 0.18 + Math.sin(clock.getElapsedTime() * 1.5) * 0.06;
  });
  return (
    <group>
      {/* Main cylindrical storage tank */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.82, 20]} />
        <meshStandardMaterial
          ref={tankRef}
          color="#E8EEF0"
          roughness={0.35}
          metalness={0.4}
          emissive={isOn ? '#FF6010' : '#000'}
          emissiveIntensity={isOn ? 0.18 : 0}
        />
      </mesh>
      {/* Bottom insulation band */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.19, 0.185, 0.06, 20]} />
        {mat('#BBBFC2', 0.5, 0.3)}
      </mesh>
      {/* Top pipe elbow */}
      <mesh position={[0, 0.87, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.14, 8]} />
        {mat('#9AACB4', 0.3, 0.6)}
      </mesh>
      <mesh position={[0.07, 0.93, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.1, 8]} />
        {mat('#9AACB4', 0.3, 0.6)}
      </mesh>
      {/* Control dial + indicator */}
      <mesh position={[0.18, 0.52, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 0.02, 10]} />
        {mat('#D0D8DC', 0.3, 0.5)}
      </mesh>
      <mesh position={[0.182, 0.52, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.004, 8]} />
        <meshStandardMaterial
          color={isOn ? '#FF4400' : '#228822'}
          emissive={isOn ? '#FF4400' : '#228822'}
          emissiveIntensity={isOn ? 2.5 : 1.0}
        />
      </mesh>
      {/* Brand label panel */}
      <mesh position={[0, 0.48, 0.182]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.24, 0.14]} />
        {mat('#1A4A6A', 0.9)}
      </mesh>
    </group>
  );
}

export function WaterMotorGeometry({ isOn }: { isOn: boolean }) {
  const impellerRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!impellerRef.current) return;
    if (isOn) {
      impellerRef.current.rotation.y += delta * 12;
    }
  });
  return (
    <group>
      {/* Motor body */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.26, 16]} />
        {mat('#1A2A38', 0.5, 0.45)}
      </mesh>
      {/* Pump housing */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.16, 0.06, 16]} />
        {mat('#263545', 0.55, 0.4)}
      </mesh>
      {/* Outlet pipe */}
      <mesh position={[0.18, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, 0.14, 8]} />
        {mat('#607D8B', 0.35, 0.6)}
      </mesh>
      {/* Inlet pipe bottom */}
      <mesh position={[0, -0.04, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.1, 8]} />
        {mat('#607D8B', 0.35, 0.6)}
      </mesh>
      {/* Rotating impeller (visible top) */}
      <group ref={impellerRef} position={[0, 0.285, 0]}>
        {[0, 90, 180, 270].map((deg, i) => (
          <mesh key={i} rotation={[0, deg * Math.PI / 180, 0]}>
            <boxGeometry args={[0.1, 0.014, 0.022]} />
            {mat('#2E7D9A', 0.4, 0.5)}
          </mesh>
        ))}
      </group>
      {/* Status LED */}
      <mesh position={[0, 0.29, 0.14]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial
          color={isOn ? '#00FF44' : '#FF3300'}
          emissive={isOn ? '#00FF44' : '#FF3300'}
          emissiveIntensity={isOn ? 2.5 : 1.0}
        />
      </mesh>
    </group>
  );
}

export function PressureCookerGeometry({ isOn, whistleCount = 0 }: { isOn: boolean; whistleCount?: number }) {
  const steamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!steamRef.current) return;
    const t = clock.getElapsedTime();
    if (isOn && whistleCount > 0) {
      steamRef.current.scale.setScalar(1 + Math.sin(t * 8) * 0.3);
      (steamRef.current.material as THREE.MeshStandardMaterial).opacity = 0.5 + Math.sin(t * 6) * 0.3;
    } else {
      steamRef.current.scale.setScalar(isOn ? 1 + Math.sin(t * 2) * 0.08 : 0.001);
      (steamRef.current.material as THREE.MeshStandardMaterial).opacity = isOn ? 0.35 : 0;
    }
  });

  return (
    <group>
      {/* Main pot body */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.22, 20]} />
        {mat('#B0B8C0', 0.25, 0.75)}
      </mesh>
      {/* Lid */}
      <mesh position={[0, 0.225, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.21, 0.04, 20]} />
        {mat('#A8B0B8', 0.3, 0.7)}
      </mesh>
      {/* Pressure weight / whistle valve */}
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.05, 10]} />
        {mat('#E0C060', 0.3, 0.7)}
      </mesh>
      {/* Handles */}
      {[[-1, 0], [1, 0]].map(([sx], i) => (
        <mesh key={i} position={[sx * 0.26, 0.1, 0]} rotation={[0, 0, sx * 0.3]} castShadow>
          <boxGeometry args={[0.08, 0.032, 0.042]} />
          {mat('#222', 0.85)}
        </mesh>
      ))}
      {/* Steam puff above valve */}
      <mesh ref={steamRef} position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          roughness={1}
          depthWrite={false}
        />
      </mesh>
      {/* Induction base ring */}
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.012, 20]} />
        {mat('#888', 0.4, 0.6)}
      </mesh>
    </group>
  );
}

export function FlowerVaseGeometry() {
  const glassColor = '#E0F7FA'; // frosted clear glass
  const waterColor = '#B2EBF2'; // light blue water
  const stemColor = '#4CAF50';  // green stems
  const petalColors = ['#E91E63', '#FFEB3B', '#FF9800', '#9C27B0']; // pink, yellow, orange, purple

  return (
    <group>
      {/* Sleek glass vase */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.28, 16]} />
        <meshStandardMaterial
          color={glassColor}
          emissive="#B2EBF2"
          emissiveIntensity={0.15}
          transparent
          opacity={0.55}
          roughness={0.12}
          metalness={0.1}
        />
      </mesh>
      {/* Water inside vase */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.065, 0.085, 0.14, 16]} />
        <meshStandardMaterial color={waterColor} transparent opacity={0.65} roughness={0.1} />
      </mesh>
      {/* Stems */}
      {[
        [0.08, 0.12, 0.15],
        [-0.08, -0.15, 0.20],
        [0.15, 0.08, -0.12],
      ].map(([rx, rz, ry], i) => (
        <group key={i} position={[0, 0.2, 0]} rotation={[rx, ry, rz]}>
          {/* Stem rod */}
          <mesh castShadow>
            <cylinderGeometry args={[0.006, 0.008, 0.26, 6]} />
            <meshStandardMaterial color={stemColor} roughness={0.7} />
          </mesh>
          {/* Flower bud */}
          <mesh position={[0, 0.14, 0]} castShadow>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color={petalColors[i % petalColors.length]} roughness={0.6} />
          </mesh>
          {/* Small leaves */}
          <mesh position={[0, 0.06, 0]} rotation={[0.4, 0, 0.4]} castShadow>
            <sphereGeometry args={[0.024, 6, 6]} />
            <meshStandardMaterial color={stemColor} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
