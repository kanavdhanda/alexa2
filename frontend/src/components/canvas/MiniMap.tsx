import { useAppStore } from '../../store/store';

const MAP_W = 180;
const MAP_H = 140;
const PADDING = 10;

// Compute bounds of all rooms
function getRoomBounds(rooms: { position: { x: number; z: number }; width: number; depth: number }[]) {
  if (rooms.length === 0) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of rooms) {
    const hw = r.width / 2;
    const hd = r.depth / 2;
    minX = Math.min(minX, r.position.x - hw);
    maxX = Math.max(maxX, r.position.x + hw);
    minZ = Math.min(minZ, r.position.z - hd);
    maxZ = Math.max(maxZ, r.position.z + hd);
  }
  return { minX, maxX, minZ, maxZ };
}

export function MiniMap() {
  const { rooms, placedObjects, ui, setActiveRoom, toggleMiniMap } = useAppStore();

  const bounds = getRoomBounds(rooms);
  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxZ - bounds.minZ;

  const drawW = MAP_W - PADDING * 2;
  const drawH = MAP_H - PADDING * 2;

  const scaleX = drawW / worldW;
  const scaleZ = drawH / worldH;
  const scale = Math.min(scaleX, scaleZ);

  const toScreen = (wx: number, wz: number) => ({
    x: PADDING + (wx - bounds.minX) * scale + (drawW - worldW * scale) / 2,
    y: PADDING + (wz - bounds.minZ) * scale + (drawH - worldH * scale) / 2,
  });

  const ROOM_COLORS: Record<string, string> = {
    'living-room':    '#C8894A',
    kitchen:          '#5AAAC0',
    'master-bedroom': '#A060C0',
    bathroom:         '#48B888',
    office:           '#A8A830',
  };

  return (
    <div
      className="absolute bottom-12 left-3 z-20 bg-[#121212] border border-[#383838] rounded-xl overflow-hidden shadow-2xl"
      style={{ width: MAP_W, height: MAP_H }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-[#383838]">
        <span className="text-[9px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Floor Plan</span>
        <button
          onClick={toggleMiniMap}
          className="text-[#8A8A8A] hover:text-white text-xs leading-none"
        >
          ×
        </button>
      </div>

      {/* SVG map */}
      <svg width={MAP_W} height={MAP_H - 22} style={{ display: 'block' }}>
        {/* Rooms */}
        {rooms.map((room) => {
          const tl = toScreen(room.position.x - room.width / 2, room.position.z - room.depth / 2);
          const roomW = room.width * scale;
          const roomH = room.depth * scale;
          const isActive = ui.activeRoomId === room.id;
          const isHovered = ui.hoveredRoomId === room.id;
          const color = ROOM_COLORS[room.id] ?? '#888';

          // Count active devices
          const activeDevices = placedObjects.filter(
            (o) => o.parentRoomId === room.id && o.isAlexaDevice && o.alexaDeviceState.isOn
          ).length;

          return (
            <g key={room.id}>
              <rect
                x={tl.x}
                y={tl.y}
                width={roomW}
                height={roomH}
                rx={3}
                fill={color}
                fillOpacity={isActive ? 0.5 : 0.2}
                stroke={isActive ? '#00A8E0' : isHovered ? '#6699cc' : '#383838'}
                strokeWidth={isActive ? 1.5 : 0.75}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveRoom(isActive ? null : room.id)}
              />
              {/* Room icon */}
              <text
                x={tl.x + roomW / 2}
                y={tl.y + roomH / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={roomH > 20 ? 9 : 7}
                fill={isActive ? '#00A8E0' : '#8A8A8A'}
              >
                {room.icon}
              </text>
              {/* Active device badge */}
              {activeDevices > 0 && (
                <>
                  <circle
                    cx={tl.x + roomW - 6}
                    cy={tl.y + 6}
                    r={5}
                    fill="#1A1A1A"
                    stroke="#1DB954"
                    strokeWidth={1}
                  />
                  <text
                    x={tl.x + roomW - 6}
                    y={tl.y + 6.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={6}
                    fontWeight="bold"
                    fill="#1DB954"
                  >
                    {activeDevices}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Placed objects */}
        {placedObjects.map((obj) => {
          const pt = toScreen(obj.position.x, obj.position.z);
          const isOn = obj.alexaDeviceState.isOn;
          const isSelected = ui.selectedObjectId === obj.id;
          if (!obj.isAlexaDevice) return null;

          return (
            <circle
              key={obj.id}
              cx={pt.x}
              cy={pt.y}
              r={isSelected ? 4 : 3}
              fill={isOn ? '#00A8E0' : '#383838'}
              stroke={isSelected ? '#00CAFF' : 'none'}
              strokeWidth={1.5}
              opacity={isOn ? 0.9 : 0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
