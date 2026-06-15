import { useMemo } from 'react';
import { useAppStore } from '../../store/store';

// Convert Kelvin color temperature to RGB hex
function kelvinToHex(k: number): string {
  // Clamp to bulb range
  const t = Math.max(1000, Math.min(10000, k));

  let r: number, g: number, b: number;

  // Red channel
  if (t <= 6600) {
    r = 255;
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow((t / 100) - 60, -0.1332047592)));
  }

  // Green channel
  if (t <= 6600) {
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(t / 100) - 161.1195681661));
  } else {
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow((t / 100) - 60, -0.0755148492)));
  }

  // Blue channel
  if (t >= 6600) {
    b = 255;
  } else if (t <= 1900) {
    b = 0;
  } else {
    b = Math.max(0, Math.min(255, 138.5177312231 * Math.log(t / 100 - 10) - 305.0447927307));
  }

  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Heights for smart-bulb placement (Y position of the actual light source)
// Bulbs sit at ceiling height ~ 2.7 units; adjust if bulb mesh Y differs
const BULB_LIGHT_Y = 2.5;

export function SmartLights() {
  const placedObjects = useAppStore((s) => s.placedObjects);

  const bulbs = useMemo(
    () =>
      placedObjects.filter(
        (o) =>
          (o.type === 'smart-bulb' || o.type === 'ceiling-fan') &&
          o.alexaDeviceState.isOn
      ),
    [placedObjects]
  );

  return (
    <>
      {bulbs.map((obj) => {
        const ds = obj.alexaDeviceState;
        const brightness = (ds.brightness ?? 80) / 100;
        const colorTemp = ds.colorTemp ?? 3000;
        const color = kelvinToHex(colorTemp);
        // Intensity scales with brightness; ceiling bulbs cast down
        const intensity = brightness * 2.8;
        const pos: [number, number, number] = [
          obj.position.x,
          BULB_LIGHT_Y,
          obj.position.z,
        ];

        return (
          <group key={obj.id}>
            {/* Main point light */}
            <pointLight
              position={pos}
              intensity={intensity}
              color={color}
              distance={8}
              decay={2}
              castShadow={brightness > 0.4}
              shadow-mapSize-width={512}
              shadow-mapSize-height={512}
              shadow-bias={-0.002}
            />
            {/* Small emissive glow sphere at bulb location */}
            <mesh position={pos}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={brightness * 3}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
