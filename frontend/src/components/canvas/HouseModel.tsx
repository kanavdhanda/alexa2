import { useEffect, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';

function HouseOBJ() {
  const groupRef = useRef<THREE.Group>(null);

  const materials = useLoader(MTLLoader, '/models/house.mtl', (loader) => {
    loader.setPath('/models/');
  });

  const obj = useLoader(OBJLoader, '/models/house.obj', (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  useEffect(() => {
    if (!obj || !groupRef.current) return;

    // Auto-scale: compute bounding box and fit to our world coordinate system
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());

    // Our house spans roughly 15 world units wide, scale accordingly
    const maxDim = Math.max(size.x, size.z);
    const targetSize = 16;
    const scale = targetSize / maxDim;

    obj.scale.setScalar(scale);
    // Center in XZ, sit on Y=0
    obj.position.set(-center.x * scale, -bbox.min.y * scale, -center.z * scale);

    // Make all surfaces semi-transparent so interior is visible
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          if (m) {
            m.transparent = true;
            m.opacity = 0.22;
            m.depthWrite = false;
            m.side = THREE.DoubleSide;
            if (m instanceof THREE.MeshStandardMaterial) {
              m.roughness = 0.85;
              m.metalness = 0.05;
            }
          }
        });
        child.receiveShadow = true;
      }
    });
  }, [obj]);

  return <primitive ref={groupRef} object={obj} />;
}

export function HouseModel() {
  return (
    <HouseOBJ />
  );
}
