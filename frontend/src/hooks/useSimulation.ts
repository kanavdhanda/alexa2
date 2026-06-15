import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/store';

export function useSimulation(intervalMs = 2000) {
  const tickSimulation = useAppStore((s) => s.tickSimulation);
  const addNotification = useAppStore((s) => s.addNotification);
  const placedObjects = useAppStore((s) => s.placedObjects);
  const prevMotion = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const id = setInterval(() => {
      tickSimulation();
    }, intervalMs);
    return () => clearInterval(id);
  }, [tickSimulation, intervalMs]);

  // Watch for motion sensor triggers and fire notifications
  useEffect(() => {
    for (const obj of placedObjects) {
      if (obj.type === 'motion-sensor' && obj.alexaDeviceState.isOn) {
        const prev = prevMotion.current[obj.id] ?? false;
        const curr = obj.alexaDeviceState.motionDetected ?? false;
        if (curr && !prev) {
          addNotification(`👁️ Motion detected by ${obj.deviceName}!`, 'warning', obj.id);
        }
        prevMotion.current[obj.id] = curr;
      }
    }
  }, [placedObjects, addNotification]);
}
