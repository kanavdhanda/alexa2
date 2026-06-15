// TierBadge — shows T0/T1/T3/CACHED result with latency + cost
// Animated entrance, color-coded, used after every simulate/voice event.

interface TierBadgeProps {
  tier: string;
  latency?: string;
  cost?: string;
  className?: string;
  compact?: boolean;
}

const TIER_CONFIG: Record<string, {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}> = {
  T0: {
    label: 'LOCAL REFLEX',
    emoji: '⚡',
    color: '#4ADE80',
    bg: '#0A2010',
    border: '#166534',
    glow: 'rgba(74,222,128,0.25)',
  },
  T1: {
    label: 'LOCAL NLU',
    emoji: '🧠',
    color: '#60A5FA',
    bg: '#0A1828',
    border: '#1E3A5F',
    glow: 'rgba(96,165,250,0.25)',
  },
  T3: {
    label: 'CLOUD · BEDROCK',
    emoji: '☁️',
    color: '#FBB040',
    bg: '#1A1000',
    border: '#5A3A00',
    glow: 'rgba(251,176,64,0.25)',
  },
  CACHED: {
    label: 'CACHE HIT',
    emoji: '💾',
    color: '#C084FC',
    bg: '#100A20',
    border: '#4C1D95',
    glow: 'rgba(192,132,252,0.25)',
  },
};

export function TierBadge({ tier, latency, cost, className = '', compact = false }: TierBadgeProps) {
  const cfg = TIER_CONFIG[tier] ?? {
    label: tier,
    emoji: '⚙️',
    color: '#9CA3AF',
    bg: '#111',
    border: '#374151',
    glow: 'rgba(156,163,175,0.15)',
  };

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${className}`}
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
      >
        {cfg.emoji} {tier}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl p-3 ${className}`}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 0 16px ${cfg.glow}`,
        animation: 'tier-badge-in 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`
        @keyframes tier-badge-in {
          from { opacity: 0; transform: translateY(6px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div className="flex items-center gap-2">
        <span className="text-xl">{cfg.emoji}</span>
        <div className="flex-1">
          <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: cfg.color }}>
            {tier} · {cfg.label}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            {latency && (
              <span className="text-[11px] font-mono text-white opacity-80">{latency}</span>
            )}
            {cost && (
              <span className="text-[11px] font-mono opacity-60" style={{ color: cfg.color }}>{cost}</span>
            )}
          </div>
        </div>
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: cfg.color }}
        />
      </div>
    </div>
  );
}
