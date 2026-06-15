import { useState, useEffect } from 'react';
import { useAppStore } from '../../store/store';
import { ASSET_MAP } from '../../constants/assets';
import type { PlacedObject } from '../../types';

export function InspectorPanel() {
  const { ui, placedObjects, updatePlacedObject, updateAlexaState, toggleAlexaDevice, removePlacedObject, rooms } =
    useAppStore();
  const selectedObj = placedObjects.find((o) => o.id === ui.selectedObjectId) ?? null;

  if (!selectedObj) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-[#121212]">
        <div className="w-14 h-14 rounded-full bg-[#242424] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[#8A8A8A]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-xs font-semibold text-[#8A8A8A] mb-1">Nothing selected</p>
        <p className="text-[10px] text-[#555] leading-snug">Click any object in the 3D scene to inspect and configure it.</p>
      </div>
    );
  }

  return (
    <ObjectForm
      obj={selectedObj}
      rooms={rooms}
      onUpdate={updatePlacedObject}
      onUpdateAlexa={updateAlexaState}
      onToggle={toggleAlexaDevice}
      onDelete={removePlacedObject}
    />
  );
}

function ObjectForm({
  obj,
  rooms,
  onUpdate,
  onUpdateAlexa,
  onToggle,
  onDelete,
}: {
  obj: PlacedObject;
  rooms: { id: string; name: string; icon?: string }[];
  onUpdate: (id: string, updates: Partial<PlacedObject>) => void;
  onUpdateAlexa: (id: string, updates: Partial<PlacedObject['alexaDeviceState']>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const def = ASSET_MAP.get(obj.type);
  const [name, setName] = useState(obj.deviceName);
  const [desc, setDesc] = useState(obj.description);

  useEffect(() => {
    setName(obj.deviceName);
    setDesc(obj.description);
  }, [obj.id]);

  const commit = () => onUpdate(obj.id, { deviceName: name, description: desc });
  const ds = obj.alexaDeviceState;

  return (
    <div className="flex flex-col gap-0 h-full bg-[#121212] overflow-y-auto">
      {/* Object header card */}
      <div
        className="mx-3 mt-3 mb-3 rounded-2xl p-3 border"
        style={{
          background: (obj.color ?? '#333') + '15',
          borderColor: (obj.color ?? '#333') + '40',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: (obj.color ?? '#333') + '22' }}
          >
            {def?.emoji ?? '📦'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wider">{obj.type.replace(/-/g, ' ')}</p>
            <p className="text-sm font-bold text-white truncate">{obj.deviceName}</p>
            {obj.isAlexaDevice && (
              <div className={`flex items-center gap-1 mt-0.5 ${ds.isOn ? 'text-[#1DB954]' : 'text-[#8A8A8A]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${ds.isOn ? 'bg-[#1DB954]' : 'bg-[#383838]'}`} />
                <span className="text-[10px] font-medium">{ds.isOn ? 'Online' : 'Offline'}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => onDelete(obj.id)}
            className="shrink-0 p-1.5 rounded-lg bg-[#2A1010] border border-[#5A2020] text-[#F44336] hover:bg-[#3A1515] transition-colors"
            title="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Alexa power toggle (prominent) */}
      {obj.isAlexaDevice && (
        <div className="mx-3 mb-3 flex items-center justify-between px-4 py-3 rounded-xl bg-[#242424] border border-[#383838]">
          <div>
            <p className="text-xs font-semibold text-white">Power</p>
            <p className="text-[10px] text-[#8A8A8A]">{ds.isOn ? 'Device is on' : 'Device is off'}</p>
          </div>
          <button
            onClick={() => onToggle(obj.id)}
            className={`relative w-14 h-7 rounded-full transition-colors ${ds.isOn ? 'bg-[#00A8E0]' : 'bg-[#383838]'}`}
          >
            <span
              className={`absolute top-1.5 w-4 h-4 bg-white rounded-full shadow-md transition-all ${
                ds.isOn ? 'left-[34px]' : 'left-1.5'
              }`}
            />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 px-3 pb-3">
        {/* Name */}
        <Field label="Device Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            className="w-full bg-[#1A1A1A] border border-[#383838] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A8E0] transition-colors"
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={commit}
            rows={3}
            className="w-full bg-[#1A1A1A] border border-[#383838] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A8E0] transition-colors resize-none leading-relaxed"
          />
        </Field>

        {/* Room assignment */}
        <Field label="Room">
          <select
            value={obj.parentRoomId ?? ''}
            onChange={(e) => onUpdate(obj.id, { parentRoomId: e.target.value || null })}
            className="w-full bg-[#1A1A1A] border border-[#383838] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00A8E0] transition-colors"
          >
            <option value="">— No room —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.icon} {r.name}
              </option>
            ))}
          </select>
        </Field>

        {/* Position */}
        <Field label="Position (X / Y / Z)">
          <div className="flex gap-1.5">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <div key={axis} className="flex-1 bg-[#1A1A1A] border border-[#383838] rounded-lg px-2 py-1.5 text-xs text-[#8A8A8A]">
                <span className="text-[#555] uppercase text-[9px]">{axis} </span>
                <span className="text-white">{obj.position[axis].toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Field>

        {/* Alexa device controls */}
        {obj.isAlexaDevice && (
          <div className="flex flex-col gap-3 pt-1 border-t border-[#383838]">
            <p className="text-[10px] font-bold text-[#00A8E0] uppercase tracking-wider">Alexa Device Controls</p>

            {ds.brightness !== undefined && (
              <SliderField
                label="Brightness"
                value={ds.brightness}
                min={0} max={100}
                unit="%"
                color="#FFD700"
                onChange={(v) => onUpdateAlexa(obj.id, { brightness: v })}
                disabled={!ds.isOn}
              />
            )}

            {ds.colorTemp !== undefined && (
              <SliderField
                label="Color Temp"
                value={ds.colorTemp}
                min={2700} max={6500}
                unit="K"
                color="#88CCFF"
                onChange={(v) => onUpdateAlexa(obj.id, { colorTemp: v })}
                disabled={!ds.isOn}
              />
            )}

            {ds.temperature !== undefined && (
              <SliderField
                label="Temperature"
                value={ds.temperature}
                min={16} max={30} step={0.5}
                unit="°C"
                color="#2196F3"
                onChange={(v) => onUpdateAlexa(obj.id, { temperature: v })}
                disabled={!ds.isOn}
              />
            )}

            {ds.volume !== undefined && (
              <SliderField
                label="Volume"
                value={ds.volume}
                min={0} max={100}
                unit="%"
                color="#00A8E0"
                onChange={(v) => onUpdateAlexa(obj.id, { volume: v })}
                disabled={!ds.isOn}
              />
            )}

            {ds.speed !== undefined && (
              <SliderField
                label="Speed"
                value={ds.speed}
                min={1} max={5} step={1}
                unit=""
                color="#90A4AE"
                onChange={(v) => onUpdateAlexa(obj.id, { speed: v })}
                disabled={!ds.isOn}
              />
            )}

            {ds.humidity !== undefined && (
              <ReadOnlyField label="Humidity" value={`${ds.humidity.toFixed(0)}%`} />
            )}

            {ds.airQuality !== undefined && (
              <ReadOnlyField
                label="Air Quality (AQI)"
                value={`${ds.airQuality.toFixed(0)} ${ds.airQuality < 50 ? '✓ Good' : ds.airQuality < 100 ? '~ Moderate' : '! Poor'}`}
              />
            )}

            {ds.batteryLevel !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8A8A8A]">Battery</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#383838] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ds.batteryLevel}%`,
                        background:
                          ds.batteryLevel > 50 ? '#1DB954' : ds.batteryLevel > 20 ? '#FF8C00' : '#F44336',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[#00A8E0]">{ds.batteryLevel.toFixed(0)}%</span>
                </div>
              </div>
            )}

            {ds.motionDetected !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8A8A8A]">Motion</span>
                <button
                  onClick={() => onUpdateAlexa(obj.id, { motionDetected: !ds.motionDetected })}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    ds.motionDetected
                      ? 'bg-[#FF8C0033] border border-[#FF8C0066] text-[#FF8C00]'
                      : 'bg-[#242424] border border-[#383838] text-[#8A8A8A]'
                  }`}
                >
                  {ds.motionDetected ? '👁️ Detected' : 'Clear'}
                </button>
              </div>
            )}

            {ds.isLocked !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8A8A8A]">Lock</span>
                <button
                  onClick={() => onUpdateAlexa(obj.id, { isLocked: !ds.isLocked })}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                    ds.isLocked
                      ? 'bg-[#1DB95433] border border-[#1DB95466] text-[#1DB954]'
                      : 'bg-[#F4433633] border border-[#F4433666] text-[#F44336]'
                  }`}
                >
                  {ds.isLocked ? '🔒 Locked' : '🔓 Unlocked'}
                </button>
              </div>
            )}

            {ds.powerConsumption !== undefined && (
              <ReadOnlyField label="Power Draw" value={`${ds.isOn ? ds.powerConsumption.toFixed(0) : 0}W`} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[#8A8A8A]">{label}</span>
      <span className="text-[10px] text-[#00A8E0] font-medium">{value}</span>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  color,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  color: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-[#8A8A8A]">{label}</span>
        <span className="text-[10px] font-semibold" style={{ color }}>
          {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1"
        style={{ accentColor: color }}
      />
    </div>
  );
}
