import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// PBR material — realistic look without cel-shading bands.
function mat(color: string, roughness = 0.75, metalness = 0.05, emissive?: string, emissiveIntensity = 0) {
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

// ── Furniture ────────────────────────────────────────────────────────────────

export function SofaGeometry() {
  const seat = '#8B6355';
  const back = '#6B4535';
  const cush = '#9B7365';
  return (
    <group>
      {/* Legs */}
      {[[-0.8,-0.3],[-0.8,0.3],[0.8,-0.3],[0.8,0.3]].map(([x,z],i)=>(
        <mesh key={i} position={[x,0.06,z]} castShadow>
          <boxGeometry args={[0.06,0.12,0.06]}/>
          {mat('#3a2820')}
        </mesh>
      ))}
      {/* Seat */}
      <mesh position={[0,0.22,0.05]} castShadow receiveShadow>
        <boxGeometry args={[1.78,0.3,0.65]}/>
        {mat(seat)}
      </mesh>
      {/* Back */}
      <mesh position={[0,0.55,-0.28]} castShadow>
        <boxGeometry args={[1.78,0.5,0.14]}/>
        {mat(back)}
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.82,0.38,0.05]} castShadow>
        <boxGeometry args={[0.14,0.4,0.65]}/>
        {mat(back)}
      </mesh>
      {/* Right arm */}
      <mesh position={[0.82,0.38,0.05]} castShadow>
        <boxGeometry args={[0.14,0.4,0.65]}/>
        {mat(back)}
      </mesh>
      {/* Cushions */}
      {[-0.55,0,0.55].map((x,i)=>(
        <mesh key={i} position={[x,0.4,0.02]} castShadow>
          <boxGeometry args={[0.52,0.12,0.58]}/>
          {mat(cush,0.95)}
        </mesh>
      ))}
    </group>
  );
}

export function BedGeometry() {
  return (
    <group>
      {/* Frame */}
      <mesh position={[0,0.12,0]} castShadow receiveShadow>
        <boxGeometry args={[1.62,0.22,2.12]}/>
        {mat('#5C3D2E',0.8)}
      </mesh>
      {/* Mattress */}
      <mesh position={[0,0.3,0.05]} castShadow>
        <boxGeometry args={[1.5,0.2,1.95]}/>
        {mat('#F0EDE0',0.9)}
      </mesh>
      {/* Headboard */}
      <mesh position={[0,0.58,-0.95]} castShadow>
        <boxGeometry args={[1.62,0.65,0.12]}/>
        {mat('#4A2C1A',0.75)}
      </mesh>
      {/* Footboard */}
      <mesh position={[0,0.38,1.01]} castShadow>
        <boxGeometry args={[1.62,0.22,0.1]}/>
        {mat('#4A2C1A',0.75)}
      </mesh>
      {/* Pillow 1 */}
      <mesh position={[-0.38,0.44,-0.68]} castShadow>
        <boxGeometry args={[0.58,0.1,0.38]}/>
        {mat('#FFFDE8',0.95)}
      </mesh>
      {/* Pillow 2 */}
      <mesh position={[0.38,0.44,-0.68]} castShadow>
        <boxGeometry args={[0.58,0.1,0.38]}/>
        {mat('#F5EFD5',0.95)}
      </mesh>
      {/* Blanket */}
      <mesh position={[0,0.42,0.3]} castShadow>
        <boxGeometry args={[1.44,0.06,1.2]}/>
        {mat('#8FA8C8',0.9)}
      </mesh>
    </group>
  );
}

export function TableGeometry() {
  const top = '#A0705A';
  const leg = '#7A5040';
  return (
    <group>
      {/* Tabletop */}
      <mesh position={[0,0.73,0]} castShadow receiveShadow>
        <boxGeometry args={[1.22,0.07,0.82]}/>
        {mat(top,0.7)}
      </mesh>
      {/* Legs */}
      {[[-0.54,0.36,-0.36],[-0.54,0.36,0.36],[0.54,0.36,-0.36],[0.54,0.36,0.36]].map(([x,y,z],i)=>(
        <mesh key={i} position={[x,y,z]} castShadow>
          <cylinderGeometry args={[0.035,0.04,0.75,8]}/>
          {mat(leg,0.75)}
        </mesh>
      ))}
    </group>
  );
}

export function ChairGeometry() {
  const c = '#8D6E63';
  const d = '#6D4E43';
  return (
    <group>
      {/* Seat */}
      <mesh position={[0,0.44,0]} castShadow receiveShadow>
        <boxGeometry args={[0.5,0.08,0.5]}/>
        {mat(c)}
      </mesh>
      {/* Back */}
      <mesh position={[0,0.72,-0.22]} castShadow>
        <boxGeometry args={[0.5,0.55,0.07]}/>
        {mat(d)}
      </mesh>
      {/* Back slats */}
      {[-0.14,0,0.14].map((x,i)=>(
        <mesh key={i} position={[x,0.68,-0.22]}>
          <boxGeometry args={[0.06,0.38,0.04]}/>
          {mat('#9D8070')}
        </mesh>
      ))}
      {/* Legs */}
      {[[-0.2,0.22,-0.2],[-0.2,0.22,0.2],[0.2,0.22,-0.2],[0.2,0.22,0.2]].map(([x,y,z],i)=>(
        <mesh key={i} position={[x,y,z]} castShadow>
          <cylinderGeometry args={[0.025,0.03,0.48,8]}/>
          {mat('#5A3A2A',0.75)}
        </mesh>
      ))}
    </group>
  );
}

export function TVStandGeometry() {
  return (
    <group>
      {/* Main body */}
      <mesh position={[0,0.26,0]} castShadow receiveShadow>
        <boxGeometry args={[1.52,0.5,0.46]}/>
        {mat('#1a1a1a',0.4,0.3)}
      </mesh>
      {/* Door panels */}
      {[-0.38,0.38].map((x,i)=>(
        <mesh key={i} position={[x,0.26,0.24]} castShadow>
          <boxGeometry args={[0.66,0.44,0.02]}/>
          {mat('#2a2a2a',0.3,0.2)}
        </mesh>
      ))}
      {/* Handles */}
      {[-0.38,0.38].map((x,i)=>(
        <mesh key={i} position={[x,0.26,0.262]}>
          <boxGeometry args={[0.1,0.02,0.02]}/>
          {mat('#888888',0.3,0.6)}
        </mesh>
      ))}
      {/* Top shelf */}
      <mesh position={[0,0.52,0]}>
        <boxGeometry args={[1.5,0.03,0.44]}/>
        {mat('#111111',0.3,0.2)}
      </mesh>
      {/* Legs */}
      {[[-0.68,0.06,-0.15],[-0.68,0.06,0.15],[0.68,0.06,-0.15],[0.68,0.06,0.15]].map(([x,y,z],i)=>(
        <mesh key={i} position={[x,y,z]}>
          <boxGeometry args={[0.04,0.12,0.04]}/>
          {mat('#888888',0.3,0.5)}
        </mesh>
      ))}
    </group>
  );
}

export function BookshelfGeometry() {
  const wood = '#6D4C2A';
  const bookColors = ['#C0392B','#2980B9','#27AE60','#8E44AD','#F39C12','#16A085','#E74C3C','#3498DB'];
  return (
    <group>
      {/* Frame */}
      <mesh position={[0,0.9,0]} castShadow receiveShadow>
        <boxGeometry args={[0.88,1.82,0.3]}/>
        {mat(wood,0.75)}
      </mesh>
      {/* Back panel */}
      <mesh position={[0,0.9,-0.13]}>
        <boxGeometry args={[0.82,1.76,0.04]}/>
        {mat('#5A3820',0.85)}
      </mesh>
      {/* Shelves */}
      {[0.28,0.64,1.0,1.36,1.62].map((y,i)=>(
        <mesh key={i} position={[0,y,0]}>
          <boxGeometry args={[0.84,0.04,0.28]}/>
          {mat('#8B6040',0.7)}
        </mesh>
      ))}
      {/* Books on each shelf */}
      {[0.44,0.8,1.16,1.52].map((y,si)=>(
        Array.from({length:6}).map((_,bi)=>{
          const bw = 0.1 + Math.random()*0.04;
          const bh = 0.18 + Math.random()*0.1;
          return (
            <mesh key={`${si}-${bi}`} position={[-0.34 + bi*0.12, y+bh/2, -0.01]}>
              <boxGeometry args={[bw, bh, 0.22]}/>
              {mat(bookColors[(si*6+bi)%bookColors.length],0.9)}
            </mesh>
          );
        })
      ))}
    </group>
  );
}

export function BathtubGeometry() {
  return (
    <group>
      {/* Outer shell */}
      <mesh position={[0,0.26,0]} castShadow receiveShadow>
        <boxGeometry args={[0.78,0.52,1.62]}/>
        {mat('#F8F8F8',0.15,0.1)}
      </mesh>
      {/* Inner basin */}
      <mesh position={[0,0.38,0.02]}>
        <boxGeometry args={[0.58,0.3,1.38]}/>
        {mat('#E8F4F8',0.1,0.05)}
      </mesh>
      {/* Faucet base */}
      <mesh position={[0,0.54,-0.68]}>
        <boxGeometry args={[0.08,0.08,0.06]}/>
        {mat('#C0C0C0',0.2,0.7)}
      </mesh>
      {/* Faucet spout */}
      <mesh position={[0,0.62,-0.66]} rotation={[0.3,0,0]}>
        <cylinderGeometry args={[0.02,0.02,0.2,8]}/>
        {mat('#C0C0C0',0.2,0.7)}
      </mesh>
      {/* Legs */}
      {[[-0.32,0.06,-0.72],[-0.32,0.06,0.72],[0.32,0.06,-0.72],[0.32,0.06,0.72]].map(([x,y,z],i)=>(
        <mesh key={i} position={[x,y,z]}>
          <cylinderGeometry args={[0.04,0.05,0.14,8]}/>
          {mat('#C0C0C0',0.2,0.7)}
        </mesh>
      ))}
    </group>
  );
}

export function DeskGeometry() {
  const wood = '#BCAAA4';
  const frame = '#546E7A';
  return (
    <group>
      {/* Top */}
      <mesh position={[0,0.74,0]} castShadow receiveShadow>
        <boxGeometry args={[1.42,0.06,0.72]}/>
        {mat(wood,0.7)}
      </mesh>
      {/* Left panel */}
      <mesh position={[-0.68,0.37,0]} castShadow>
        <boxGeometry args={[0.06,0.76,0.68]}/>
        {mat(frame,0.5,0.1)}
      </mesh>
      {/* Right panel */}
      <mesh position={[0.68,0.37,0]} castShadow>
        <boxGeometry args={[0.06,0.76,0.68]}/>
        {mat(frame,0.5,0.1)}
      </mesh>
      {/* Back brace */}
      <mesh position={[0,0.37,-0.31]}>
        <boxGeometry args={[1.3,0.06,0.06]}/>
        {mat(frame,0.5)}
      </mesh>
      {/* Drawer unit */}
      <mesh position={[0.42,0.3,0.05]}>
        <boxGeometry args={[0.5,0.44,0.62]}/>
        {mat('#607D8B',0.5)}
      </mesh>
      {/* Monitor */}
      <mesh position={[0,0.98,-0.18]} rotation={[0.12,0,0]} castShadow>
        <boxGeometry args={[0.52,0.35,0.04]}/>
        {mat('#1a1a1a',0.3,0.2)}
      </mesh>
      <mesh position={[0,0.82,-0.1]}>
        <boxGeometry args={[0.06,0.24,0.06]}/>
        {mat('#333',0.4)}
      </mesh>
    </group>
  );
}

export function PlantGeometry() {
  return (
    <group>
      {/* Pot */}
      <mesh position={[0,0.14,0]} castShadow>
        <cylinderGeometry args={[0.12,0.1,0.26,12]}/>
        {mat('#C1440E',0.85)}
      </mesh>
      {/* Soil */}
      <mesh position={[0,0.28,0]}>
        <cylinderGeometry args={[0.11,0.11,0.03,12]}/>
        {mat('#2C1810',0.95)}
      </mesh>
      {/* Stem */}
      <mesh position={[0,0.42,0]} castShadow>
        <cylinderGeometry args={[0.018,0.022,0.26,6]}/>
        {mat('#3A6B35',0.85)}
      </mesh>
      {/* Foliage */}
      <mesh position={[0,0.62,0]} castShadow>
        <sphereGeometry args={[0.22,12,10]}/>
        {mat('#2E7D32',0.9)}
      </mesh>
      {/* Sub-foliage */}
      <mesh position={[0.12,0.52,0.08]} castShadow>
        <sphereGeometry args={[0.14,10,8]}/>
        {mat('#388E3C',0.9)}
      </mesh>
      <mesh position={[-0.1,0.5,-0.06]} castShadow>
        <sphereGeometry args={[0.13,10,8]}/>
        {mat('#43A047',0.9)}
      </mesh>
    </group>
  );
}

export function WardrobeGeometry() {
  const wood = '#8D6E63';
  const dark = '#5D3E3A';
  return (
    <group>
      {/* Body */}
      <mesh position={[0,1.0,0]} castShadow receiveShadow>
        <boxGeometry args={[1.22,2.02,0.56]}/>
        {mat(wood,0.75)}
      </mesh>
      {/* Left door */}
      <mesh position={[-0.3,1.0,0.29]} castShadow>
        <boxGeometry args={[0.56,1.92,0.04]}/>
        {mat('#A07868',0.7)}
      </mesh>
      {/* Right door */}
      <mesh position={[0.3,1.0,0.29]} castShadow>
        <boxGeometry args={[0.56,1.92,0.04]}/>
        {mat('#A07868',0.7)}
      </mesh>
      {/* Handles */}
      {[[-0.06,1.0,0.32],[0.06,1.0,0.32]].map(([x,y,z],i)=>(
        <mesh key={i} position={[x,y,z]}>
          <cylinderGeometry args={[0.018,0.018,0.14,8]}/>
          {mat('#C0A080',0.3,0.5)}
        </mesh>
      ))}
      {/* Top trim */}
      <mesh position={[0,2.04,0]}>
        <boxGeometry args={[1.28,0.08,0.62]}/>
        {mat(dark,0.7)}
      </mesh>
    </group>
  );
}

// ── Alexa Device Geometry ─────────────────────────────────────────────────────

export function EchoDotGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0,0.05,0]} castShadow>
        <cylinderGeometry args={[0.16,0.17,0.1,24]}/>
        {mat('#2a2a2a',0.3,0.2)}
      </mesh>
      {/* Top face */}
      <mesh position={[0,0.101,0]}>
        <cylinderGeometry args={[0.155,0.155,0.005,24]}/>
        {mat('#1a1a1a',0.2,0.1)}
      </mesh>
      {/* LED ring */}
      <mesh position={[0,0.1,0]}>
        <torusGeometry args={[0.115,0.012,8,32]}/>
        {mat(isOn ? '#00A8E0' : '#1a1a1a', 0.1, 0.3, isOn ? '#00A8E0' : '#000', isOn ? 1.0 : 0)}
      </mesh>
      {/* Mic dots */}
      {[0,90,180,270].map((deg,i)=>{
        const r = 0.08;
        const a = deg * Math.PI/180;
        return (
          <mesh key={i} position={[Math.sin(a)*r, 0.107, Math.cos(a)*r]}>
            <cylinderGeometry args={[0.006,0.006,0.004,6]}/>
            {mat('#333333')}
          </mesh>
        );
      })}
    </group>
  );
}

export function EchoShowGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Base */}
      <mesh position={[0,0.04,0.04]} castShadow>
        <boxGeometry args={[0.52,0.08,0.32]}/>
        {mat('#1a1a1a',0.2,0.2)}
      </mesh>
      {/* Screen */}
      <mesh position={[0,0.28,-0.06]} rotation={[0.35,0,0]} castShadow>
        <boxGeometry args={[0.48,0.38,0.04]}/>
        {mat('#111111',0.2,0.15)}
      </mesh>
      {/* Screen face */}
      <mesh position={[0,0.28,-0.04]} rotation={[0.35,0,0]}>
        <boxGeometry args={[0.44,0.34,0.001]}/>
        {mat(isOn ? '#0a2040' : '#080808', 0.05, 0.1, isOn ? '#1a4a80' : '#000', isOn ? 0.5 : 0)}
      </mesh>
      {/* Camera */}
      <mesh position={[0,0.44,-0.1]} rotation={[0.35,0,0]}>
        <cylinderGeometry args={[0.018,0.018,0.02,12]}/>
        {mat('#333333')}
      </mesh>
    </group>
  );
}

export function SmartBulbGeometry({ isOn, color }: { isOn: boolean; color: string }) {
  // Hanging pendant: cord at top (y=0 = ceiling attach), globe hangs below
  return (
    <group>
      {/* Cord from ceiling */}
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.36, 6]} />
        {mat('#444444', 0.9, 0.1)}
      </mesh>
      {/* Socket at bottom of cord */}
      <mesh position={[0, -0.38, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.055, 0.1, 12]} />
        {mat('#888888', 0.3, 0.5)}
      </mesh>
      {/* Neck */}
      <mesh position={[0, -0.48, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.06, 12]} />
        {mat('#666666', 0.3, 0.3)}
      </mesh>
      {/* Bulb globe */}
      <mesh position={[0, -0.59, 0]} castShadow>
        <sphereGeometry args={[0.1, 14, 12]} />
        {mat(isOn ? color : '#e0e0e0', 0.1, 0.05, isOn ? color : '#000', isOn ? 2.2 : 0)}
      </mesh>
      {/* Warm glow disc below bulb when on */}
      {isOn && (
        <mesh position={[0, -0.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.18, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.18} />
        </mesh>
      )}
    </group>
  );
}

export function ThermostatGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Wall mount */}
      <mesh position={[0,0.15,-0.02]}>
        <boxGeometry args={[0.28,0.32,0.04]}/>
        {mat('#dddddd',0.2,0.05)}
      </mesh>
      {/* Round body */}
      <mesh position={[0,0.15,0.02]} castShadow>
        <cylinderGeometry args={[0.12,0.12,0.04,32]}/>
        {mat('#f0f0f0',0.15,0.1)}
      </mesh>
      {/* Ring */}
      <mesh position={[0,0.15,0.045]}>
        <torusGeometry args={[0.1,0.01,8,32]}/>
        {mat(isOn ? '#FF6B00' : '#aaaaaa', 0.2, 0.3, isOn ? '#FF4400' : '#000', isOn ? 0.8 : 0)}
      </mesh>
      {/* Display */}
      <mesh position={[0,0.15,0.045]}>
        <cylinderGeometry args={[0.065,0.065,0.002,32]}/>
        {mat(isOn ? '#1a2a1a' : '#0a0a0a', 0.1)}
      </mesh>
    </group>
  );
}

export function SmartPlugGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0,0.07,0]} castShadow>
        <boxGeometry args={[0.1,0.14,0.07]}/>
        {mat('#ffffff',0.3,0.05)}
      </mesh>
      {/* Prongs */}
      {[-0.02,0.02].map((x,i)=>(
        <mesh key={i} position={[x,-0.02,0.02]}>
          <boxGeometry args={[0.015,0.06,0.008]}/>
          {mat('#888888',0.2,0.7)}
        </mesh>
      ))}
      {/* Status LED */}
      <mesh position={[0,0.1,0.036]}>
        <sphereGeometry args={[0.01,6,6]}/>
        {mat(isOn ? '#00ff44' : '#333333', 0.1, 0, isOn ? '#00ff44' : '#000', isOn ? 2 : 0)}
      </mesh>
    </group>
  );
}

export function MotionSensorGeometry({ isOn, motionDetected }: { isOn: boolean; motionDetected?: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0,0.075,0]} castShadow>
        <boxGeometry args={[0.14,0.15,0.08]}/>
        {mat('#f5f5f5',0.2,0.05)}
      </mesh>
      {/* Lens dome */}
      <mesh position={[0,0.09,0.042]}>
        <sphereGeometry args={[0.05,12,8]}/>
        {mat(isOn ? (motionDetected ? '#ff4400' : '#4488ff') : '#888888', 0.1, 0.2,
           isOn ? (motionDetected ? '#ff4400' : '#2244aa') : '#000',
           isOn ? (motionDetected ? 1.5 : 0.3) : 0)}
      </mesh>
    </group>
  );
}

export function SmartLockGeometry({ isLocked }: { isOn: boolean; isLocked?: boolean }) {
  const c = '#2c2c2c';
  return (
    <group>
      {/* Housing */}
      <mesh position={[0,0.12,0]} castShadow>
        <boxGeometry args={[0.1,0.22,0.05]}/>
        {mat(c,0.3,0.3)}
      </mesh>
      {/* Keypad dots */}
      {[[-0.02,0.15],[0.02,0.15],[-0.02,0.1],[0.02,0.1],[-0.02,0.05],[0.02,0.05]].map(([x,y],i)=>(
        <mesh key={i} position={[x,y,0.028]}>
          <cylinderGeometry args={[0.008,0.008,0.006,6]}/>
          {mat('#555555')}
        </mesh>
      ))}
      {/* Status indicator */}
      <mesh position={[0,0.22,0.028]}>
        <sphereGeometry args={[0.008,6,6]}/>
        {mat(isLocked ? '#22cc44' : '#cc2222', 0.1, 0, isLocked ? '#22cc44' : '#cc2222', 1.5)}
      </mesh>
    </group>
  );
}

export function CameraGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0,0.08,0]} castShadow>
        <boxGeometry args={[0.18,0.12,0.12]}/>
        {mat('#222222',0.3,0.2)}
      </mesh>
      {/* Lens ring */}
      <mesh position={[0,0.08,0.065]}>
        <torusGeometry args={[0.04,0.012,8,16]}/>
        {mat('#444444',0.2,0.4)}
      </mesh>
      {/* Lens */}
      <mesh position={[0,0.08,0.074]}>
        <cylinderGeometry args={[0.03,0.03,0.02,16]}/>
        {mat('#111111',0.05,0.1, isOn ? '#004488' : '#000', isOn ? 0.5 : 0)}
      </mesh>
      {/* IR LEDs */}
      {[[-0.06,0.11],[0.06,0.11],[-0.06,0.04],[0.06,0.04]].map(([x,y],i)=>(
        <mesh key={i} position={[x,y,0.062]}>
          <sphereGeometry args={[0.008,6,6]}/>
          {mat(isOn ? '#FF0000' : '#220000', 0.1, 0, isOn ? '#FF0000' : '#000', isOn ? 0.5 : 0)}
        </mesh>
      ))}
    </group>
  );
}

export function SmokeDetectorGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Flat disc */}
      <mesh position={[0,0.04,0]} castShadow>
        <cylinderGeometry args={[0.12,0.12,0.07,24]}/>
        {mat('#f0f0f0',0.2,0.05)}
      </mesh>
      {/* Test button */}
      <mesh position={[0.07,0.078,0]}>
        <cylinderGeometry args={[0.018,0.018,0.01,10]}/>
        {mat('#dddddd')}
      </mesh>
      {/* LED */}
      <mesh position={[0,0.078,0.07]}>
        <sphereGeometry args={[0.012,8,6]}/>
        {mat(isOn ? '#22cc44' : '#333333', 0.1, 0, isOn ? '#22cc44' : '#000', isOn ? 1 : 0)}
      </mesh>
      {/* Vent holes pattern */}
      {Array.from({length:8}).map((_,i)=>{
        const a = (i/8)*Math.PI*2;
        return (
          <mesh key={i} position={[Math.cos(a)*0.08,0.078,Math.sin(a)*0.08]}>
            <boxGeometry args={[0.012,0.004,0.03]}/>
            {mat('#dddddd')}
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
    screenRef.current.emissiveIntensity = 0.55 + Math.sin(t * 0.8) * 0.06;
  });

  return (
    <group>
      {/* Screen */}
      <mesh position={[0,0.5,0]} castShadow>
        <boxGeometry args={[1.4,0.82,0.06]}/>
        {mat('#111111',0.2,0.15)}
      </mesh>
      {/* Screen face — animated when on */}
      <mesh position={[0,0.5,0.032]}>
        <boxGeometry args={[1.3,0.74,0.001]}/>
        <meshStandardMaterial
          ref={screenRef}
          color={isOn ? '#041230' : '#080808'}
          emissive={isOn ? '#1040A0' : '#000000'}
          emissiveIntensity={isOn ? 0.55 : 0}
          roughness={0.05}
          metalness={0.1}
        />
      </mesh>
      {/* Bezel */}
      <mesh position={[0,0.5,0.034]}>
        <boxGeometry args={[1.34,0.78,0.001]}/>
        {mat('#1a1a1a',0.2)}
      </mesh>
      {/* Stand neck */}
      <mesh position={[0,0.06,0.01]}>
        <boxGeometry args={[0.08,0.14,0.06]}/>
        {mat('#222222',0.2,0.2)}
      </mesh>
      {/* Stand base */}
      <mesh position={[0,0,0]}>
        <boxGeometry args={[0.38,0.04,0.2]}/>
        {mat('#222222',0.2,0.2)}
      </mesh>
      {/* Power LED */}
      <mesh position={[0.6,-0.02,0.034]}>
        <sphereGeometry args={[0.008,6,6]}/>
        {mat(isOn ? '#00ff44' : '#220000', 0.1, 0, isOn ? '#00ff44' : '#000', isOn ? 1.5 : 0)}
      </mesh>
    </group>
  );
}

export function CeilingFanGeometry({ isOn, speed = 1 }: { isOn: boolean; speed?: number }) {
  const bladesRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!bladesRef.current) return;
    if (isOn) {
      bladesRef.current.rotation.y += delta * speed * 4.5;
    } else if (Math.abs(bladesRef.current.rotation.y % (Math.PI * 2)) > 0.01) {
      // Gradual deceleration when turned off
      bladesRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group>
      {/* Drop rod from ceiling */}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.36, 8]} />
        {mat('#999999', 0.3, 0.5)}
      </mesh>
      {/* Motor housing */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 16]} />
        {mat('#888888', 0.3, 0.4)}
      </mesh>
      {/* Spinning blades */}
      <group ref={bladesRef}>
        {[0, 90, 180, 270].map((deg, i) => (
          <group key={i} rotation={[0, deg * Math.PI / 180, 0]}>
            <mesh position={[0.28, 0.01, 0]}>
              <boxGeometry args={[0.52, 0.022, 0.13]} />
              {mat('#8B6914', 0.8)}
            </mesh>
            {/* Blade tip detail */}
            <mesh position={[0.52, 0.01, 0]}>
              <boxGeometry args={[0.06, 0.022, 0.1]} />
              {mat('#7A5A10', 0.8)}
            </mesh>
          </group>
        ))}
      </group>
      {/* Light fixture hanging below motor */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.065, 0.045, 0.09, 12]} />
        {mat('#E0E0E0', 0.15, 0.1, isOn ? '#FFFDE7' : '#000', isOn ? 1.2 : 0)}
      </mesh>
    </group>
  );
}

export function DoorbellGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Housing */}
      <mesh position={[0,0.1,0]} castShadow>
        <boxGeometry args={[0.09,0.18,0.05]}/>
        {mat('#FF8F00',0.3,0.2)}
      </mesh>
      {/* Camera lens */}
      <mesh position={[0,0.12,0.028]}>
        <cylinderGeometry args={[0.022,0.022,0.018,12]}/>
        {mat('#111111',0.1,0.2)}
      </mesh>
      {/* Button */}
      <mesh position={[0,0.04,0.028]}>
        <cylinderGeometry args={[0.02,0.02,0.01,10]}/>
        {mat('#ffffff',0.1)}
      </mesh>
      {/* IR ring */}
      <mesh position={[0,0.12,0.03]}>
        <torusGeometry args={[0.028,0.005,6,12]}/>
        {mat(isOn ? '#880000' : '#222222', 0.1, 0, isOn ? '#440000' : '#000', isOn ? 0.3 : 0)}
      </mesh>
    </group>
  );
}

export function AirPurifierGeometry({ isOn }: { isOn: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0,0.3,0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13,0.15,0.62,16]}/>
        {mat('#e8e8e8',0.15,0.05)}
      </mesh>
      {/* Top vent ring */}
      <mesh position={[0,0.62,0]}>
        <torusGeometry args={[0.1,0.03,8,16]}/>
        {mat('#cccccc',0.2,0.1)}
      </mesh>
      {/* Filter display ring */}
      <mesh position={[0,0.42,0.137]}>
        <cylinderGeometry args={[0.01,0.01,0.1,8]}/>
        {mat(isOn ? '#00aaff' : '#333333', 0.1, 0.3, isOn ? '#00aaff' : '#000', isOn ? 1.2 : 0)}
      </mesh>
      {/* Control panel */}
      <mesh position={[0,0.22,0.14]}>
        <boxGeometry args={[0.1,0.12,0.01]}/>
        {mat('#1a1a1a',0.2)}
      </mesh>
    </group>
  );
}
