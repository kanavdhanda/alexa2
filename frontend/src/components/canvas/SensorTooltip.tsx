import type { PlacedObject } from '../../types';
import { ASSET_MAP } from '../../constants/assets';

interface SensorTooltipProps {
  obj: PlacedObject;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Row({ icon, label, value, bar, barColor, barMax, highlight }: {
  icon: string; label: string; value: string;
  bar?: boolean; barColor?: string; barMax?: number; highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 py-1 border-b border-[#2a2a2a] last:border-0`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#8A8A8A] flex items-center gap-1">
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        <span className={`text-[10px] font-semibold ${highlight ? 'text-[#F44336]' : 'text-[#00A8E0]'}`}>{value}</span>
      </div>
      {bar && barColor && barMax !== undefined && (
        <Bar value={parseFloat(value)} max={barMax} color={barColor} />
      )}
    </div>
  );
}

export function SensorTooltip({ obj }: SensorTooltipProps) {
  const def = ASSET_MAP.get(obj.type);
  const ds = obj.alexaDeviceState;
  const isOn = ds.isOn;

  const rows: React.ReactNode[] = [];

  if (ds.temperature !== undefined) {
    rows.push(
      <Row key="temp" icon="🌡️" label="Temperature" value={`${ds.temperature.toFixed(1)}°C`}
        bar barColor={ds.temperature > 26 ? '#F44336' : ds.temperature < 18 ? '#2196F3' : '#4CAF50'}
        barMax={30} />
    );
  }
  if (ds.humidity !== undefined) {
    rows.push(
      <Row key="hum" icon="💧" label="Humidity" value={`${ds.humidity.toFixed(0)}%`}
        bar barColor="#2196F3" barMax={100} />
    );
  }
  if (ds.brightness !== undefined) {
    rows.push(
      <Row key="bright" icon="💡" label="Brightness" value={`${ds.brightness}%`}
        bar barColor="#FFD700" barMax={100} />
    );
  }
  if (ds.colorTemp !== undefined) {
    rows.push(
      <Row key="ctemp" icon="🎨" label="Color Temp" value={`${ds.colorTemp}K`}
        bar barColor="#88CCFF" barMax={6500} />
    );
  }
  if (ds.volume !== undefined) {
    rows.push(
      <Row key="vol" icon="🔊" label="Volume" value={`${ds.volume}%`}
        bar barColor="#9C27B0" barMax={100} />
    );
  }
  if (ds.speed !== undefined) {
    rows.push(
      <Row key="speed" icon="💨" label="Fan Speed" value={`${ds.speed}/5`}
        bar barColor="#00BCD4" barMax={5} />
    );
  }
  if (ds.airQuality !== undefined) {
    const aqiLabel = ds.airQuality < 50 ? 'Good' : ds.airQuality < 100 ? 'Moderate' : 'Poor';
    rows.push(
      <Row key="aqi" icon="🌬️" label="Air Quality" value={`AQI ${ds.airQuality.toFixed(0)} — ${aqiLabel}`}
        highlight={ds.airQuality > 100} />
    );
  }
  if (ds.batteryLevel !== undefined) {
    rows.push(
      <Row key="bat" icon="🔋" label="Battery"
        value={`${ds.batteryLevel.toFixed(0)}%`}
        bar barColor={ds.batteryLevel > 50 ? '#4CAF50' : ds.batteryLevel > 20 ? '#FF9800' : '#F44336'}
        barMax={100}
        highlight={ds.batteryLevel < 20} />
    );
  }
  if (ds.motionDetected !== undefined) {
    rows.push(
      <Row key="motion" icon="👁️" label="Motion" value={ds.motionDetected ? 'Detected!' : 'Clear'}
        highlight={ds.motionDetected} />
    );
  }
  if (ds.isLocked !== undefined) {
    rows.push(
      <Row key="lock" icon={ds.isLocked ? '🔒' : '🔓'} label="Lock"
        value={ds.isLocked ? 'Locked' : 'Unlocked'}
        highlight={!ds.isLocked} />
    );
  }
  if (ds.channel !== undefined && isOn) {
    rows.push(<Row key="ch" icon="📺" label="Channel" value={`CH ${ds.channel}`} />);
  }
  if (ds.powerConsumption !== undefined) {
    rows.push(
      <Row key="pw" icon="⚡" label="Power Draw" value={isOn ? `${ds.powerConsumption.toFixed(1)}W` : '0W'} />
    );
  }

  return (
    <div
      className="pointer-events-none select-none"
      style={{
        background: 'rgba(15,15,20,0.97)',
        border: '1px solid rgba(0,168,224,0.35)',
        borderRadius: 14,
        padding: '10px 12px',
        minWidth: 190,
        maxWidth: 230,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,168,224,0.1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2a2a2a]">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ background: (obj.color ?? '#333') + '25', border: `1px solid ${obj.color ?? '#333'}40` }}
        >
          {def?.emoji ?? '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate leading-tight">{obj.deviceName}</p>
          <p className="text-[10px] text-[#8A8A8A] capitalize leading-tight">{obj.type.replace(/-/g,' ')}</p>
        </div>
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
          isOn ? 'bg-[#1DB95425] text-[#1DB954]' : 'bg-[#38383825] text-[#8A8A8A]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-[#1DB954]' : 'bg-[#8A8A8A]'}`} />
          {isOn ? 'ON' : 'OFF'}
        </div>
      </div>

      {/* Sensor rows */}
      {!isOn && rows.length === 0 ? (
        <p className="text-[10px] text-[#555] text-center py-1">Device is offline</p>
      ) : rows.length > 0 ? (
        <div className="flex flex-col">{rows}</div>
      ) : (
        <p className="text-[10px] text-[#555] text-center py-1">No sensors</p>
      )}

      {/* Triangle arrow */}
      <div
        style={{
          position: 'absolute',
          bottom: -7,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '7px solid rgba(0,168,224,0.35)',
        }}
      />
    </div>
  );
}
