import { useRef } from 'react';
import { useAppStore } from '../../store/store';

export function Header() {
  const {
    ui, setActiveRoom, exportState, importState, rooms, placedObjects,
    toggleMiniMap, enterLayoutEditMode, exitLayoutEditMode, lockLayout,
  } = useAppStore();
  const { activeRoomId, isPlacementMode, isLayoutEditMode, layoutLocked } = ui;
  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live energy stats
  const onDevices = placedObjects.filter((o) => o.isAlexaDevice && o.alexaDeviceState.isOn);
  const totalWatts = onDevices.reduce((s, o) => s + (o.alexaDeviceState.powerConsumption ?? 0), 0);
  const totalDevices = placedObjects.filter((o) => o.isAlexaDevice).length;

  const handleExport = () => {
    const json = exportState();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'digital-twin-state.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importState(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-[#1A1A1A] border-b border-[#383838] shrink-0 z-10">
      {/* Logo + Breadcrumb */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          {/* Alexa ring logo */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              background: 'conic-gradient(from 0deg, #005580, #0080B0, #00A8E0, #00CAFF, #0080B0, #005580)',
            }}
          >
            <div className="w-5 h-5 rounded-full bg-[#1A1A1A] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00A8E0]" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none tracking-wide">Alexa Digital Twin</h1>
            <p className="text-[10px] text-[#00A8E0] leading-none mt-0.5">Smart Home Simulator</p>
          </div>
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs">
          <button
            onClick={() => setActiveRoom(null)}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              !activeRoomId
                ? 'bg-[#00A8E0] text-[#121212] font-semibold'
                : 'text-[#8A8A8A] hover:text-white hover:bg-[#242424]'
            }`}
          >
            🏠 House
          </button>
          {activeRoom && (
            <>
              <span className="text-[#383838]">/</span>
              <span className="px-2.5 py-1 rounded-lg bg-[#242424] text-[#00A8E0] font-semibold">
                {activeRoom.icon} {activeRoom.name}
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Right: stats + actions */}
      <div className="flex items-center gap-3">
        {/* Live energy chip */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#242424] border border-[#383838]">
          <span className="text-[10px] text-[#8A8A8A]">⚡</span>
          <span className="text-xs font-bold text-white">{totalWatts.toFixed(0)}W</span>
          <span className="text-[10px] text-[#8A8A8A]">·</span>
          <span className={`text-xs font-semibold ${onDevices.length > 0 ? 'text-[#1DB954]' : 'text-[#8A8A8A]'}`}>
            {onDevices.length}<span className="text-[#8A8A8A] font-normal">/{totalDevices}</span>
          </span>
        </div>

        {/* Placement mode badge */}
        {isPlacementMode && (
          <span className="text-[10px] bg-[#00A8E0] text-[#121212] px-2 py-1 rounded-lg font-bold animate-pulse">
            PLACING
          </span>
        )}

        {/* Layout Edit / Lock controls */}
        {layoutLocked ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A1000] border border-[#FF8C00] text-[10px] text-[#FF8C00] font-semibold">
            🔒 Locked
          </div>
        ) : isLayoutEditMode ? (
          <div className="flex items-center gap-1">
            <button
              onClick={lockLayout}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FF8C00] text-black text-[10px] font-bold hover:bg-[#FFA030] transition-colors"
            >
              🔒 Lock Layout
            </button>
            <button
              onClick={exitLayoutEditMode}
              className="px-2 py-1 rounded-lg bg-[#242424] border border-[#FF8C0066] text-[10px] text-[#FF8C00] hover:border-[#FF8C00] transition-colors"
            >
              Exit Edit
            </button>
          </div>
        ) : (
          <button
            onClick={enterLayoutEditMode}
            title="Edit layout — drag objects to reposition"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#242424] border border-[#383838] text-[10px] text-[#8A8A8A] hover:text-[#FF8C00] hover:border-[#FF8C0066] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            Edit Layout
          </button>
        )}

        {/* Minimap toggle */}
        <button
          onClick={toggleMiniMap}
          title="Toggle floor plan"
          className={`p-1.5 rounded-lg transition-colors ${
            ui.showMiniMap ? 'text-[#00A8E0] bg-[#1A3A4A]' : 'text-[#8A8A8A] hover:text-white bg-[#242424]'
          } border border-[#383838]`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
        </button>

        {/* Import */}
        <button
          onClick={() => fileRef.current?.click()}
          title="Import state"
          className="p-1.5 rounded-lg bg-[#242424] border border-[#383838] text-[#8A8A8A] hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

        {/* Export */}
        <button
          onClick={handleExport}
          title="Export state"
          className="p-1.5 rounded-lg bg-[#242424] border border-[#383838] text-[#8A8A8A] hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
