import * as THREE from 'three';

// Smooth 16-step gradient — keeps MeshToonMaterial's soft-body look without harsh cel bands.
export const TOON_GRADIENT = (() => {
  const steps = 16;
  const data = new Uint8Array(steps).map((_, i) => Math.round(55 + (i / (steps - 1)) * 200));
  const t = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
