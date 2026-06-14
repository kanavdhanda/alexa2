import { v4 as uuidv4 } from 'uuid';
import { HomeState, ProposedRule, T0Rule, Regime, EventRecord } from './stateStore';

export interface MiningResult {
  proposals: ProposedRule[];
  patterns_found: number;
  events_analyzed: number;
  regime_filtered: number;
  mining_timestamp: string;
}

export interface PatternCandidate {
  antecedent: { event_type: string; data_key: string; data_value: any };
  consequent: { event_type: string; action_device_id: string; action_property: string; action_value: any };
  support: number;
  confidence: number;
  time_window_minutes: number;
}

function extractActuateCalls(action_taken: any): Array<{ device_id: string; property: string; value: any }> {
  if (!action_taken?.tool_calls) return [];
  const results: Array<{ device_id: string; property: string; value: any }> = [];
  for (const tc of action_taken.tool_calls) {
    if (tc.tool_name === 'actuate_home_device' && tc.tool_input) {
      results.push({
        device_id: tc.tool_input.device_id ?? tc.tool_input.deviceId ?? 'unknown',
        property: tc.tool_input.property ?? tc.tool_input.prop ?? 'power',
        value: tc.tool_input.value ?? tc.tool_input.new_value ?? true,
      });
    }
  }
  return results;
}

function ruleAlreadyExists(home: HomeState, condition_fn_key: string, condition_params: Record<string, any>, action: { device_id: string; property: string; value: any }): boolean {
  return home.t0_rules.some(
    (r) =>
      r.condition_fn_key === condition_fn_key &&
      r.action.device_id === action.device_id &&
      r.action.property === action.property &&
      JSON.stringify(r.condition_params) === JSON.stringify(condition_params)
  );
}

export function mineRules(home: HomeState): MiningResult {
  const allEvents = home.event_history;
  const regime_filtered = allEvents.filter(
    (e) => e.regime_at_time === 'festival' || e.regime_at_time === 'guest'
  ).length;

  const normalEvents = allEvents.filter((e) => e.regime_at_time === 'normal');
  const events_analyzed = normalEvents.length;

  const proposals: ProposedRule[] = [];
  const now = new Date();

  // --- Step b/c: T3 events with actuate_home_device tool calls ---
  const t3Events = normalEvents.filter(
    (e) => e.tier === 'T3' && e.action_taken?.tool_calls
  );

  // Build co-occurrence map: preceding event_type → { device_id_property_value → count[] }
  const coOccurrence = new Map<
    string,
    Map<string, { count: number; times: number[] }>
  >();

  for (const t3ev of t3Events) {
    const t3Time = new Date(t3ev.timestamp).getTime();
    const actuations = extractActuateCalls(t3ev.action_taken);
    if (actuations.length === 0) continue;

    // Preceding events within 60 min
    const preceding = normalEvents
      .filter((e) => {
        const et = new Date(e.timestamp).getTime();
        return et < t3Time && t3Time - et <= 60 * 60 * 1000;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);

    for (const pre of preceding) {
      const key = pre.event_type;
      for (const act of actuations) {
        const actKey = `${act.device_id}::${act.property}::${JSON.stringify(act.value)}`;
        if (!coOccurrence.has(key)) coOccurrence.set(key, new Map());
        const inner = coOccurrence.get(key)!;
        if (!inner.has(actKey)) inner.set(actKey, { count: 0, times: [] });
        const entry = inner.get(actKey)!;
        entry.count += 1;
        entry.times.push((t3Time - new Date(pre.timestamp).getTime()) / 60000);
      }
    }
  }

  // --- Step d: Time-of-day patterns ---
  const hourActuationMap = new Map<
    string,
    { count: number; device_id: string; property: string; value: any }
  >();

  for (const t3ev of t3Events) {
    const hour = new Date(t3ev.timestamp).getHours();
    const actuations = extractActuateCalls(t3ev.action_taken);
    for (const act of actuations) {
      const key = `${hour}::${act.device_id}::${act.property}::${JSON.stringify(act.value)}`;
      if (!hourActuationMap.has(key)) {
        hourActuationMap.set(key, { count: 0, device_id: act.device_id, property: act.property, value: act.value });
      }
      hourActuationMap.get(key)!.count += 1;
    }
  }

  let propIndex = 0;
  for (const [key, entry] of hourActuationMap.entries()) {
    if (entry.count < 3) continue;
    const hour = parseInt(key.split('::')[0], 10);
    const condition_params = { hour_of_day: hour, tolerance_minutes: 30 };
    const action = { device_id: entry.device_id, property: entry.property, value: entry.value };

    if (ruleAlreadyExists(home, 'time_of_day', condition_params, action)) continue;

    const confidence = Math.min(0.95, 0.65 + (entry.count - 3) * 0.05);
    const proposal: ProposedRule = {
      proposal_id: `prop_${Date.now()}_${propIndex++}`,
      description: `At hour ${hour}:00, turn ${action.device_id} ${action.property} to ${JSON.stringify(action.value)} (observed ${entry.count} times).`,
      pattern_support: entry.count,
      confidence,
      condition_summary: `Time of day: ${hour}:00 ± 30 min`,
      action_summary: `Set ${action.device_id}.${action.property} = ${JSON.stringify(action.value)}`,
      rule_if_confirmed: {
        rule_id: uuidv4(),
        description: `Auto-promoted: ${action.device_id} ${action.property} at hour ${hour}`,
        condition_fn_key: 'time_of_day',
        condition_params,
        action,
        confidence,
        promoted_from_t3: true,
        regime_guard: 'normal',
      },
      proposed_at: now.toISOString(),
      status: 'pending',
    };
    proposals.push(proposal);
  }

  // --- Step e: sensor→action patterns ---
  const sensorEvents = normalEvents.filter((e) => e.event_type === 'sensor_trigger');
  const sensorActionMap = new Map<
    string,
    { hits: number; total: number; device_id: string; property: string; value: any; times: number[] }
  >();

  for (const sev of sensorEvents) {
    const sevTime = new Date(sev.timestamp).getTime();
    const sensorKey = `${sev.data?.sensor_id ?? 'sensor'}::${sev.data?.value ?? 'triggered'}`;

    // Count total occurrences of this sensor pattern
    const totalCount = sensorEvents.filter(
      (x) =>
        (x.data?.sensor_id ?? 'sensor') === (sev.data?.sensor_id ?? 'sensor') &&
        (x.data?.value ?? 'triggered') === (sev.data?.value ?? 'triggered')
    ).length;

    // Find T3 actions within 10 min after
    const followingActions = t3Events.filter((t3ev) => {
      const t3Time = new Date(t3ev.timestamp).getTime();
      return t3Time > sevTime && t3Time - sevTime <= 10 * 60 * 1000;
    });

    for (const t3ev of followingActions) {
      const actuations = extractActuateCalls(t3ev.action_taken);
      for (const act of actuations) {
        const mapKey = `${sensorKey}::${act.device_id}::${act.property}`;
        if (!sensorActionMap.has(mapKey)) {
          sensorActionMap.set(mapKey, {
            hits: 0,
            total: totalCount,
            device_id: act.device_id,
            property: act.property,
            value: act.value,
            times: [],
          });
        }
        const entry = sensorActionMap.get(mapKey)!;
        entry.hits += 1;
        entry.times.push((new Date(t3ev.timestamp).getTime() - sevTime) / 60000);
      }
    }
  }

  for (const [mapKey, entry] of sensorActionMap.entries()) {
    if (entry.hits < 2) continue;
    const confidence = entry.total > 0 ? entry.hits / entry.total : 0;
    if (confidence < 0.65) continue;

    const parts = mapKey.split('::');
    const sensor_id = parts[0];
    const sensor_value = parts[1];
    const condition_params = { sensor_id, expected_value: sensor_value };
    const action = { device_id: entry.device_id, property: entry.property, value: entry.value };

    if (ruleAlreadyExists(home, 'sensor_value', condition_params, action)) continue;

    const proposal: ProposedRule = {
      proposal_id: `prop_${Date.now()}_${propIndex++}`,
      description: `When sensor ${sensor_id} reads "${sensor_value}", set ${action.device_id}.${action.property} to ${JSON.stringify(action.value)} (support: ${entry.hits}, confidence: ${(confidence * 100).toFixed(0)}%).`,
      pattern_support: entry.hits,
      confidence,
      condition_summary: `Sensor ${sensor_id} = ${sensor_value}`,
      action_summary: `Set ${action.device_id}.${action.property} = ${JSON.stringify(action.value)}`,
      rule_if_confirmed: {
        rule_id: uuidv4(),
        description: `Auto-promoted: sensor ${sensor_id} → ${action.device_id} ${action.property}`,
        condition_fn_key: 'sensor_value',
        condition_params,
        action,
        confidence,
        promoted_from_t3: true,
        regime_guard: 'normal',
      },
      proposed_at: now.toISOString(),
      status: 'pending',
    };
    proposals.push(proposal);
  }

  // --- Step c: co-occurrence patterns from preceding events ---
  for (const [precedingType, actMap] of coOccurrence.entries()) {
    const totalPreceding = normalEvents.filter((e) => e.event_type === precedingType).length;
    for (const [actKey, { count, times }] of actMap.entries()) {
      const confidence = totalPreceding > 0 ? count / totalPreceding : 0;
      if (confidence < 0.65 || count < 2) continue;

      const [device_id, property, valueStr] = actKey.split('::');
      let value: any;
      try { value = JSON.parse(valueStr); } catch { value = valueStr; }

      const condition_params = { preceding_event_type: precedingType };
      const action = { device_id, property, value };

      if (ruleAlreadyExists(home, 'duration_exceeded', condition_params, action)) continue;

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const proposal: ProposedRule = {
        proposal_id: `prop_${Date.now()}_${propIndex++}`,
        description: `After event "${precedingType}", set ${device_id}.${property} to ${JSON.stringify(value)} within ${avgTime.toFixed(1)} min (support: ${count}, confidence: ${(confidence * 100).toFixed(0)}%).`,
        pattern_support: count,
        confidence,
        condition_summary: `Preceding event: ${precedingType}`,
        action_summary: `Set ${device_id}.${property} = ${JSON.stringify(value)}`,
        rule_if_confirmed: {
          rule_id: uuidv4(),
          description: `Auto-promoted: after ${precedingType} → ${device_id} ${property}`,
          condition_fn_key: 'duration_exceeded',
          condition_params,
          action,
          confidence,
          promoted_from_t3: true,
          regime_guard: 'normal',
        },
        proposed_at: now.toISOString(),
        status: 'pending',
      };
      proposals.push(proposal);
    }
  }

  return {
    proposals,
    patterns_found: proposals.length,
    events_analyzed,
    regime_filtered,
    mining_timestamp: now.toISOString(),
  };
}

export function getPromotionNarrative(home: HomeState): string {
  const t0Count = home.t0_rules.length;

  // Estimate events/day from event_history
  const history = home.event_history;
  let eventsPerDay = 0;
  if (history.length >= 2) {
    const oldest = new Date(history[0].timestamp).getTime();
    const newest = new Date(history[history.length - 1].timestamp).getTime();
    const days = Math.max(1, (newest - oldest) / (1000 * 60 * 60 * 24));
    eventsPerDay = Math.round(history.length / days);
  }

  // Savings: each T0 rule fires ~once/day, saves $0.00004 per avoided T3 call
  const savingsPerDay = t0Count * 0.00004;
  const savingsPerMonth = (savingsPerDay * 30).toFixed(4);

  // Rules promoted from T3 in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentPromotions = home.t0_rules.filter(
    (r) => r.promoted_from_t3 && r.created_at >= thirtyDaysAgo
  ).length;

  return (
    `${t0Count} T0 rules active. ` +
    `At ${eventsPerDay} events/day, this saves ~$${savingsPerMonth}/month vs cloud-only. ` +
    `${recentPromotions} rules promoted from T3 in the last 30 days.`
  );
}
