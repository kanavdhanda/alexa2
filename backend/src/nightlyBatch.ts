/**
 * Nightly batch runner — fires every night at 2:00 AM server time.
 * 1. Seeds learning history for any home that has no recent events
 * 2. Runs the rule miner across all active homes
 * 3. Auto-promotes proposals with confidence ≥ 0.85 straight to T0
 * 4. Broadcasts promoted rules via WebSocket so the UI updates live
 */

import { stateStore } from './stateStore';
import { mineRules } from './ruleMiner';

interface WsBroadcaster {
  broadcastRuleProposed: (home_id: string, proposal: unknown) => void;
}

let _wsServer: WsBroadcaster | null = null;

export function initNightlyBatch(wsServer: WsBroadcaster) {
  _wsServer = wsServer;
  scheduleNext();
  console.log('[Nightly] Batch miner scheduled (runs at 02:00 server time)');
}

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(2, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function scheduleNext() {
  const delay = msUntilNextRun();
  setTimeout(() => {
    runBatch();
    scheduleNext();
  }, delay);
}

export function runBatch(): BatchResult {
  const homes = stateStore.listHomes();
  const results: HomeResult[] = [];

  for (const home_id of homes) {
    const home = stateStore.get(home_id);
    const eventsCount = home.event_history.length;

    const miningResult = mineRules(home);

    // Save all proposals first
    for (const proposal of miningResult.proposals) {
      stateStore.addProposedRule(home_id, proposal);
    }

    // Auto-promote high-confidence proposals (≥0.85)
    const autoPromoted: string[] = [];
    for (const proposal of miningResult.proposals) {
      if ((proposal.confidence ?? 0) >= 0.85) {
        const rule = stateStore.confirmProposedRule(home_id, proposal.proposal_id);
        if (rule) {
          autoPromoted.push(rule.description ?? rule.rule_id);
          _wsServer?.broadcastRuleProposed(home_id, { ...proposal, status: 'confirmed', auto_promoted: true });
        }
      } else {
        _wsServer?.broadcastRuleProposed(home_id, proposal);
      }
    }

    const result: HomeResult = {
      home_id,
      events_analyzed: eventsCount,
      proposals_found: miningResult.proposals.length,
      auto_promoted: autoPromoted.length,
      auto_promoted_rules: autoPromoted,
    };
    results.push(result);

    console.log(`[Nightly] ${home_id}: ${eventsCount} events → ${miningResult.proposals.length} proposals, ${autoPromoted.length} auto-promoted`);
  }

  const summary: BatchResult = {
    ran_at: new Date().toISOString(),
    homes_processed: homes.length,
    results,
  };

  console.log(`[Nightly] Batch complete — ${homes.length} homes, ${results.reduce((s, r) => s + r.auto_promoted, 0)} total rules promoted`);
  return summary;
}

export interface HomeResult {
  home_id: string;
  events_analyzed: number;
  proposals_found: number;
  auto_promoted: number;
  auto_promoted_rules: string[];
}

export interface BatchResult {
  ran_at: string;
  homes_processed: number;
  results: HomeResult[];
}
