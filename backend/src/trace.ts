export interface Trace {
  path: Array<'device' | 't0' | 't1' | 'cache' | 't3'>;
  latency_ms: number;
  cost_usd: number;
  tier_label: string;
}

const tierLabels: Record<'t0' | 't1' | 'cache' | 't3', string> = {
  t0: 'Instant reflex',
  t1: 'Thinks locally',
  cache: 'Remembered answer',
  t3: 'Asks the cloud',
};

const tierPaths: Record<'t0' | 't1' | 'cache' | 't3', Array<'device' | 't0' | 't1' | 'cache' | 't3'>> = {
  t0: ['device', 't0'],
  t1: ['device', 't0', 't1'],
  cache: ['device', 't0', 't1', 'cache'],
  t3: ['device', 't0', 't1', 'cache', 't3'],
};

export function buildTrace(
  tier: 't0' | 't1' | 'cache' | 't3',
  latencyMs: number,
  costUsd: number = 0
): Trace {
  return {
    path: tierPaths[tier],
    latency_ms: latencyMs,
    cost_usd: costUsd,
    tier_label: tierLabels[tier],
  };
}
