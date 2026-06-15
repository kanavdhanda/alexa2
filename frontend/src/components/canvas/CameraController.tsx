import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';
import { sharedCameraRef, cameraTransitionRef } from './cameraRef';

const ISO_DIST = 26;
const ISO_POS  = new THREE.Vector3(ISO_DIST, ISO_DIST * 0.88, ISO_DIST);

const HOUSE_VIEW = {
  position: ISO_POS.clone(),
  target:   new THREE.Vector3(0, 0, 0),
  zoom:     22,
};

function getRoomView(room: { position: { x: number; y: number; z: number }; width: number; depth: number }) {
  const rx = room.position.x;
  const rz = room.position.z;
  const maxDim = Math.max(room.width, room.depth);
  const d    = maxDim * 0.85;
  const zoom = Math.min(88, Math.max(36, 680 / maxDim));
  return {
    position: new THREE.Vector3(rx + d, d * 0.9, rz + d),
    target:   new THREE.Vector3(rx, 0, rz),
    zoom,
  };
}

export function CameraController() {
  const { camera } = useThree();
  const { ui, rooms } = useAppStore();
  const { activeRoomId } = ui;

  const targetPos    = useRef(HOUSE_VIEW.position.clone());
  const targetLook   = useRef(HOUSE_VIEW.target.clone());
  const currentLook  = useRef(HOUSE_VIEW.target.clone());
  const targetZoom   = useRef(HOUSE_VIEW.zoom);

  // Remember the user's zoom level before entering a room so we can restore it.
  const savedUserZoom = useRef<number | null>(null);

  const prevRoomId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevRoomId.current === undefined) {
      prevRoomId.current = activeRoomId;
      return;
    }
    if (activeRoomId === prevRoomId.current) return;
    prevRoomId.current = activeRoomId;

    const ortho = camera as THREE.OrthographicCamera;

    if (!activeRoomId) {
      // Returning to house view — restore position/look but keep user's zoom
      targetPos.current.copy(HOUSE_VIEW.position);
      targetLook.current.copy(HOUSE_VIEW.target);
      // If the user had a custom zoom before entering a room, bring it back.
      // Otherwise fall back to the default house zoom.
      targetZoom.current = savedUserZoom.current ?? HOUSE_VIEW.zoom;
      savedUserZoom.current = null;
    } else {
      // Entering a room — save current zoom so we can restore it on exit
      if (ortho.isOrthographicCamera) {
        savedUserZoom.current = ortho.zoom;
      }
      const room = rooms.find(r => r.id === activeRoomId);
      if (room) {
        const v = getRoomView(room);
        targetPos.current.copy(v.position);
        targetLook.current.copy(v.target);
        targetZoom.current = v.zoom;
      }
    }

    cameraTransitionRef.current = true;
  }, [activeRoomId, rooms, camera]);

  // Expose camera for drag-drop raycasting outside Canvas
  useEffect(() => { sharedCameraRef.current = camera; }, [camera]);

  useFrame((_, delta) => {
    // cameraTransitionRef is cleared by OrbitControls onStart — user interaction wins
    if (!cameraTransitionRef.current) return;

    const t = 1 - Math.exp(-0.014 * 60 * delta);

    camera.position.lerp(targetPos.current, t);
    currentLook.current.lerp(targetLook.current, t);
    camera.lookAt(currentLook.current);

    const ortho = camera as THREE.OrthographicCamera;
    if (ortho.isOrthographicCamera) {
      const dz = targetZoom.current - ortho.zoom;
      ortho.zoom += dz * t;
      ortho.updateProjectionMatrix();
    }

    const posClose  = camera.position.distanceTo(targetPos.current) < 0.08;
    const zoomClose = Math.abs((camera as THREE.OrthographicCamera).zoom - targetZoom.current) < 0.4;
    if (posClose && zoomClose) {
      cameraTransitionRef.current = false;
    }
  });

  return null;
}
