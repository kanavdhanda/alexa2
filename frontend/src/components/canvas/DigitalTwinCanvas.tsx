import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
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
import { draggingObjectIdRef } from './dragRef';
import type { AssetType } from '../../types';

function SceneLighting() {
  const hour = new Date().getHours();
  // Dynamic colour + intensity based on real time of day
  const sunColor   = hour >= 6  && hour < 9  ? '#FFB060'  // golden sunrise
                   : hour >= 9  && hour < 17 ? '#FFF5D0'  // neutral daylight
                   : hour >= 17 && hour < 20 ? '#FF9040'  // warm sunset
                   : '#6070A0';                            // cool night
  const sunInt     = hour >= 6 && hour < 20 ? 2.6 : 0.7;
  const ambColor   = hour >= 6 && hour < 20 ? '#F0E8D8' : '#1A2040';
  const ambInt     = hour >= 6 && hour < 20 ? 0.32 : 0.14;

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
    updatePlacedObject, exitLayoutEditMode, lockLayout,
  } = useAppStore();

  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const hoveredObj = ui.hoveredObjectId
    ? placedObjects.find((o) => o.id === ui.hoveredObjectId) ?? null
    : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ui.isPlacementMode) exitPlacementMode();
        else if (ui.selectedObjectId) setSelectedObject(null);
        else if (ui.activeRoomId) setActiveRoom(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui, setActiveRoom, setSelectedObject, exitPlacementMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    const dragId = draggingObjectIdRef.current;
    if (!dragId || !ui.isLayoutEditMode) return;

    const camera = sharedCameraRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!camera || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const xNdc = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const yNdc = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(xNdc, yNdc), camera);
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(floorPlane, hitPoint)) {
      updatePlacedObject(dragId, { position: { x: hitPoint.x, y: 0, z: hitPoint.z } });
    }
  }, [ui.isLayoutEditMode, updatePlacedObject]);

  const handleMouseUp = useCallback(() => {
    if (draggingObjectIdRef.current) {
      draggingObjectIdRef.current = null;
      setIsDragging(false);
      document.body.style.cursor = 'default';
    }
  }, []);

  const handleMouseDown = useCallback(() => {
    setTimeout(() => {
      if (draggingObjectIdRef.current) setIsDragging(true);
    }, 0);
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

  const isEditMode = ui.isLayoutEditMode && !ui.layoutLocked;
  const cursorClass = ui.isPlacementMode
    ? 'cursor-crosshair'
    : isEditMode
    ? isDragging ? 'cursor-grabbing' : 'cursor-grab'
    : '';

  return (
    <div
      ref={canvasWrapperRef}
      className={`w-full h-full relative ${cursorClass}`}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
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
          <color attach="background" args={['#D5EAF7']} />
          <fog attach="fog" args={['#D5EAF7', 60, 160]} />
          <SceneLighting />
          <Environment preset="apartment" background={false} />
          <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={50} blur={1.8} far={6} />
          <SmartLights />
          <GhostPreview />
          <CameraController />
          <OrbitControls
            makeDefault
            enabled={!ui.isPlacementMode && !isDragging}
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
          <hemisphereLight args={['#B8D4FF', '#4A7A20', 0.35]} />
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

      {/* Layout Edit Mode banner */}
      {isEditMode && (
        <>
          <div className="absolute inset-0 pointer-events-none border-2 border-[#FF8C00] border-dashed opacity-40 rounded" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#1A1000] bg-opacity-90 border border-[#FF8C00] rounded-full px-4 py-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse" />
            <span className="text-xs font-semibold text-[#FF8C00]">Layout Edit Mode — drag objects to reposition</span>
            <button
              onClick={() => lockLayout()}
              className="ml-2 text-[10px] bg-[#FF8C00] text-black font-bold rounded-full px-3 py-0.5 hover:bg-[#FFA030] transition-colors"
            >
              Lock Layout
            </button>
            <button
              onClick={() => exitLayoutEditMode()}
              className="text-[10px] text-[#FF8C00] hover:text-white border border-[#FF8C0066] rounded-full px-2 py-0.5"
            >
              Exit
            </button>
          </div>
        </>
      )}

      {/* Layout locked badge */}
      {ui.layoutLocked && !isEditMode && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-[#1A1000] border border-[#FF8C00] rounded-full px-3 py-1 text-[10px] text-[#FF8C00] font-semibold">
          🔒 Layout Locked
        </div>
      )}

      {/* Bottom hint */}
      {!ui.activeRoomId && !ui.isPlacementMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-white bg-black bg-opacity-30 px-3 py-1.5 rounded-full pointer-events-none backdrop-blur-sm">
          Click room to zoom · Scroll to zoom · Drag to orbit · Drag asset from library to drop here
        </div>
      )}
    </div>
  );
}
