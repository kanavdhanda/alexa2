import * as THREE from 'three';

// Module-level ref so DigitalTwinCanvas (outside Canvas) can access the Three.js camera
// for drag-and-drop raycasting.
export const sharedCameraRef: { current: THREE.Camera | null } = { current: null };

// Set to false by OrbitControls onStart to immediately yield camera control
// to the user when they start panning/zooming/rotating manually.
export const cameraTransitionRef: { current: boolean } = { current: false };
