import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, AdaptiveDpr } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useAppStore } from '../../store/store';
import { House } from './House';
import { Doors } from './Doors';
import { HouseDecor } from './HouseDecor';
import { CameraController } from './CameraController';
import { MiniMap } from './MiniMap';
import { SensorTooltip } from './SensorTooltip';
import { SmartLights } from './SmartLights';
import { GhostPreview } from './GhostPreview';
import { sharedCameraRef, cameraTransitionRef } from './cameraRef';
import type { AssetType } from '../../types';

function SceneLighting() {
  // Night mode: indoor smart bulb lighting dominates. Rooms with lights ON glow;
  // rooms with lights OFF stay dim — shows the digital twin's live state clearly.
  const sunColor   = '#6070A0';
  const sunInt     = 0.55;
  const ambColor   = '#1A2035';
  const ambInt     = 0.18;

  return (
    <>
      <directionalLight
        position={[18, 28, 12]}
        intensity={sunInt}
        castShadow
        color={sunColor}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={120}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.001}
      />
      <ambientLight intensity={ambInt} color={ambColor} />
    </>
  );
}

export function DigitalTwinCanvas() {
  const {
    ui, rooms, placedObjects,
    setActiveRoom, setSelectedObject, exitPlacementMode,
    toggleMiniMap, setAlexaTab, setListeningVoice, setActivePanel,
    addPlacedObject, enterPlacementMode, setDraggedAsset,
    updatePlacedObject, removePlacedObject,
  } = useAppStore();

  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const hoveredObj = ui.hoveredObjectId
    ? placedObjects.find((o) => o.id === ui.hoveredObjectId) ?? null
    : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore key events if the user is typing in inputs or textareas (like voice search / generate module)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) {
        return;
      }

      if (e.key === 'Escape') {
        if (ui.isPlacementMode) exitPlacementMode();
        else if (ui.selectedObjectId) setSelectedObject(null);
        else if (ui.activeRoomId) setActiveRoom(null);
      } else if ((e.key === 'r' || e.key === 'R') && ui.selectedObjectId) {
        const obj = placedObjects.find((o) => o.id === ui.selectedObjectId);
        if (obj) {
          const newY = (obj.rotation.y + Math.PI / 2) % (Math.PI * 2);
          updatePlacedObject(ui.selectedObjectId, {
            rotation: { ...obj.rotation, y: newY },
          });
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedObjectId) {
        removePlacedObject(ui.selectedObjectId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui, placedObjects, setActiveRoom, setSelectedObject, exitPlacementMode, updatePlacedObject, removePlacedObject]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  // Drag-and-drop from the asset library panel
  const handleDragOver = useCallback((e: React.DragEvent) => {
    const type = e.dataTransfer.getData('assetType') || e.dataTransfer.types.includes('assettype') ? e.dataTransfer.getData('assetType') || e.dataTransfer.getData('assettype') : null;
    if (type || ui.draggedAssetType) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [ui.draggedAssetType]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = (e.dataTransfer.getData('assetType') || e.dataTransfer.getData('assettype')) as AssetType | '';
    if (!type) return;

    const camera = sharedCameraRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!camera || !wrapper) {
      // Fallback: enter placement mode and let user click to place
      enterPlacementMode(type as AssetType);
      return;
    }

    // Project drop position to 3D floor (y=0 plane) via raycasting
    const rect = wrapper.getBoundingClientRect();
    const xNdc = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const yNdc = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(xNdc, yNdc), camera);
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(floorPlane, hitPoint);

    if (!hit) {
      enterPlacementMode(type as AssetType);
      return;
    }

    // Find which room the drop falls in
    let roomId: string | null = null;
    for (const room of rooms) {
      const hw = room.width / 2;
      const hd = room.depth / 2;
      if (
        hitPoint.x >= room.position.x - hw && hitPoint.x <= room.position.x + hw &&
        hitPoint.z >= room.position.z - hd && hitPoint.z <= room.position.z + hd
      ) {
        roomId = room.id;
        break;
      }
    }

    addPlacedObject(type as AssetType, { x: hitPoint.x, y: 0, z: hitPoint.z }, roomId);
    setDraggedAsset(null);
  }, [rooms, addPlacedObject, enterPlacementMode, setDraggedAsset]);

  const cursorClass = ui.isPlacementMode ? 'cursor-crosshair' : '';

  return (
    <div
      ref={canvasWrapperRef}
      className={`w-full h-full relative ${cursorClass}`}
      onMouseMove={handleMouseMove}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Canvas
        orthographic
        shadows
        camera={{ position: [22, 20, 22], zoom: 22, near: -500, far: 500 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        style={{ background: '#1a1a2e' }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#07090F']} />
          <fog attach="fog" args={['#07090F', 55, 140]} />
          <SceneLighting />
          <Environment preset="apartment" background={false} />
          <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={50} blur={1.8} far={6} />
          <SmartLights />
          <GhostPreview />
          <CameraController />
          <OrbitControls
            makeDefault
            enabled={!ui.isPlacementMode}
            minZoom={8}
            maxZoom={160}
            maxPolarAngle={Math.PI / 2.15}
            minPolarAngle={Math.PI / 5}
            enablePan
            panSpeed={0.6}
            rotateSpeed={0.4}
            zoomSpeed={0.9}
            onStart={() => { cameraTransitionRef.current = false; }}
          />
          <House />
          <Doors />
          <HouseDecor />
          <hemisphereLight args={['#2A3A60', '#102010', 0.28]} />

          {/* Post-processing: Bloom makes active LEDs/emissives visually glow;
              Vignette gives the scene a professional dashboard edge-darkening */}
          <EffectComposer multisampling={4}>
            <Bloom
              luminanceThreshold={0.85}
              luminanceSmoothing={0.2}
              intensity={0.9}
              radius={0.6}
            />
            <Vignette offset={0.28} darkness={0.42} eskil={false} />
          </EffectComposer>

          {/* Adaptive DPR — automatically reduces pixel ratio under GPU load */}
          <AdaptiveDpr pixelated />
        </Suspense>
      </Canvas>

      {/* ── DOM tooltip overlay — renders OUTSIDE Canvas, no WebGL interference ── */}
      {hoveredObj && !ui.isPlacementMode && (
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: mousePos.x + 14,
            top: mousePos.y - 14,
            zIndex: 9999,
            transform: 'translateY(-100%)',
          }}
        >
          <SensorTooltip obj={hoveredObj} />
        </div>
      )}

      {/* Minimap */}
      {ui.showMiniMap && !ui.isPlacementMode && <MiniMap />}
      {!ui.isPlacementMode && !ui.showMiniMap && (
        <button
          onClick={toggleMiniMap}
          className="absolute bottom-12 left-3 z-20 bg-[#1A1A1A] border border-[#383838] rounded-lg px-2 py-1.5 text-[10px] text-[#8A8A8A] hover:text-white hover:border-[#00A8E0] transition-all"
        >
          Show Map
        </button>
      )}

      {/* Room view controls */}
      {ui.activeRoomId && !ui.isPlacementMode && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          <button
            onClick={() => setActiveRoom(null)}
            className="flex items-center gap-1.5 bg-white bg-opacity-85 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-all shadow-md backdrop-blur-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            House View
          </button>

          <button
            onClick={() => { setActivePanel('alexa'); setAlexaTab('home'); setListeningVoice(true); }}
            className="flex items-center gap-2 bg-[#00A8E0] hover:bg-[#0090C8] text-white rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg transition-all"
            style={{ boxShadow: '0 0 12px rgba(0,168,224,0.5)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" opacity="0.4" />
              <circle cx="12" cy="12" r="6"  stroke="white" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="2.5" fill="white" />
            </svg>
            Ask Alexa
          </button>
        </div>
      )}

      {/* Placement mode banner */}
      {ui.isPlacementMode && (
        <>
          <div className="absolute inset-0 pointer-events-none border-2 border-[#00A8E0] border-dashed opacity-50 rounded" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white bg-opacity-90 border border-blue-300 rounded-full px-4 py-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-blue-700">
              Click the floor to place {ui.placementAssetType?.replace(/-/g, ' ')}
            </span>
            <button
              onClick={exitPlacementMode}
              className="ml-2 text-[10px] text-gray-500 hover:text-gray-800 border border-gray-300 rounded-full px-2 py-0.5"
            >
              Cancel (Esc)
            </button>
          </div>
        </>
      )}

      {/* Floating item selection action bar */}
      {ui.selectedObjectId && !ui.isPlacementMode && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-[#111116] border border-[#383848] rounded-xl px-4 py-2 shadow-2xl backdrop-blur-md animate-fade-in"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        >
          <span className="text-[10px] font-bold text-alexa-text uppercase tracking-widest">
            {placedObjects.find(o => o.id === ui.selectedObjectId)?.deviceName ?? 'Selected Object'}
          </span>
          <div className="flex items-center gap-1.5 border-l border-[#2B2B3A] pl-3">
            <button
              onClick={() => {
                const obj = placedObjects.find((o) => o.id === ui.selectedObjectId);
                if (obj) {
                  const newY = (obj.rotation.y + Math.PI / 2) % (Math.PI * 2);
                  updatePlacedObject(obj.id, { rotation: { ...obj.rotation, y: newY } });
                }
              }}
              className="px-2 py-1 rounded bg-[#252530] text-[9px] text-[#A0A0C0] hover:text-white hover:bg-[#353545] active:scale-95 transition-all font-bold"
            >
              🔄 Rotate (R)
            </button>
            <button
              onClick={() => {
                if (ui.selectedObjectId) removePlacedObject(ui.selectedObjectId);
              }}
              className="px-2 py-1 rounded bg-red-950 border border-red-900 text-[9px] text-red-200 hover:text-white hover:bg-red-900 active:scale-95 transition-all font-bold"
            >
              🗑️ Delete (Del)
            </button>
          </div>
        </div>
      )}

      {/* Bottom hint */}
      {!ui.activeRoomId && !ui.isPlacementMode && !ui.selectedObjectId && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black bg-opacity-30 px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
          Click room to zoom · Scroll to zoom · Drag to orbit · Drag asset from library to drop here
        </div>
      )}
    </div>
  );
}
