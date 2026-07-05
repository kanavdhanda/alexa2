import { buildTrace } from '../src/trace';

describe('buildTrace', () => {
  it('t0 trace has short path and friendly label', () => {
    const t = buildTrace('t0', 4);
    expect(t.path).toEqual(['device', 't0']);
    expect(t.tier_label).toBe('Instant reflex');
    expect(t.cost_usd).toBe(0);
    expect(t.latency_ms).toBe(4);
  });

  it('t3 trace walks the whole cascade', () => {
    const t = buildTrace('t3', 1800, 0.000035);
    expect(t.path).toEqual(['device', 't0', 't1', 'cache', 't3']);
    expect(t.tier_label).toBe('Asks the cloud');
    expect(t.cost_usd).toBeCloseTo(0.000035, 8);
    expect(t.latency_ms).toBe(1800);
  });

  it('t1 trace reflects local NLU', () => {
    const t = buildTrace('t1', 87);
    expect(t.path).toEqual(['device', 't0', 't1']);
    expect(t.tier_label).toBe('Thinks locally');
    expect(t.cost_usd).toBe(0);
    expect(t.latency_ms).toBe(87);
  });

  it('cache trace includes cache lookups', () => {
    const t = buildTrace('cache', 235, 0.0000125);
    expect(t.path).toEqual(['device', 't0', 't1', 'cache']);
    expect(t.tier_label).toBe('Remembered answer');
    expect(t.cost_usd).toBeCloseTo(0.0000125, 8);
    expect(t.latency_ms).toBe(235);
  });

  it('defaults costUsd to 0 when omitted', () => {
    const t = buildTrace('t1', 50);
    expect(t.cost_usd).toBe(0);
  });

  it('uses the exact required tier labels', () => {
    expect(buildTrace('t0', 1).tier_label).toBe('Instant reflex');
    expect(buildTrace('t1', 1).tier_label).toBe('Thinks locally');
    expect(buildTrace('cache', 1).tier_label).toBe('Remembered answer');
    expect(buildTrace('t3', 1).tier_label).toBe('Asks the cloud');
  });
});
