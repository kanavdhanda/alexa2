import { Suspense, lazy } from 'react';
import { useAppStore } from './store/store';
import { Header } from './components/layout/Header';
import { PanelTabs } from './components/layout/PanelTabs';
import { AssetLibraryPanel } from './components/panels/AssetLibraryPanel';
import { InspectorPanel } from './components/panels/InspectorPanel';
import { AlexaAppSimView } from './components/panels/AlexaAppSimView';
import { AnticipationsPanel } from './components/panels/AnticipationsPanel';
import { AppStorePanel } from './components/panels/AppStorePanel';
import { BackendPanel } from './components/panels/BackendPanel';
import { useSimulation } from './hooks/useSimulation';

const DigitalTwinCanvas = lazy(() =>
  import('./components/canvas/DigitalTwinCanvas').then((m) => ({ default: m.DigitalTwinCanvas }))
);

function RightPanel() {
  const activePanel = useAppStore((s) => s.ui.activePanel);

  return (
    <div className="flex flex-col h-full">
      <PanelTabs />
      <div className="flex-1 overflow-hidden">
        {activePanel === 'alexa' && <AlexaAppSimView />}
        {activePanel === 'library' && <AssetLibraryPanel />}
        {activePanel === 'inspector' && <InspectorPanel />}
        {activePanel === 'anticipations' && <AnticipationsPanel />}
        {activePanel === 'store' && <AppStorePanel />}
        {activePanel === 'backend' && <BackendPanel />}
      </div>
    </div>
  );
}

function CanvasLoader() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#080810]">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, #005580, #00A8E0, #00CAFF, transparent)',
          }}
        />
        <p className="text-[#00A8E0] text-sm font-semibold">Loading Digital Twin...</p>
        <p className="text-[#555] text-xs mt-1">Initializing 3D environment</p>
      </div>
    </div>
  );
}

function AppContent() {
  // Wire up real-time sensor simulation (2-second tick)
  useSimulation(2000);

  return (
    <div className="flex flex-col w-full h-full bg-[#121212]">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* 3D Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={<CanvasLoader />}>
            <DigitalTwinCanvas />
          </Suspense>
        </div>

        {/* Right panel — Alexa app simulation */}
        <div
          className="w-80 shrink-0 flex flex-col overflow-hidden"
          style={{
            background: '#1A1A1A',
            borderLeft: '1px solid #383838',
          }}
        >
          <RightPanel />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
