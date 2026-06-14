import { Request, Response } from 'express';
import { stateStore } from '../stateStore';
import { mineRules, getPromotionNarrative } from '../ruleMiner';
import { wsServer } from '../websocket';

export function runMiner(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const result = mineRules(home);

  // Save proposals
  for (const proposal of result.proposals) {
    stateStore.addProposedRule(home_id, proposal);
    wsServer?.broadcastRuleProposed(home_id, proposal);
  }

  return res.json({
    home_id,
    mining_result: result,
    narrative: getPromotionNarrative(stateStore.get(home_id)),
    instructions: 'Use POST /api/homes/:id/rules/proposed/:proposal_id/confirm to promote a rule to T0',
  });
}

export function listProposedRules(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const { status } = req.query;
  let proposals = home.proposed_rules;
  if (status) proposals = proposals.filter(p => p.status === status);
  return res.json({ home_id, count: proposals.length, proposals });
}

export function confirmRule(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const proposal_id = req.params['proposal_id'] as string;
  const rule = stateStore.confirmProposedRule(home_id, proposal_id);
  if (!rule) return res.status(404).json({ error: `Proposal ${proposal_id} not found or already actioned` });
  wsServer?.broadcastStats(home_id, stateStore.getStats(home_id));
  return res.json({ message: 'Rule promoted to T0', rule, narrative: getPromotionNarrative(stateStore.get(home_id)) });
}

export function rejectRule(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const proposal_id = req.params['proposal_id'] as string;
  const ok = stateStore.rejectProposedRule(home_id, proposal_id);
  if (!ok) return res.status(404).json({ error: `Proposal ${proposal_id} not found` });
  return res.json({ message: 'Proposal rejected', proposal_id });
}

export function listT0Rules(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  return res.json({
    home_id,
    count: home.t0_rules.length,
    t0_rules: home.t0_rules,
    narrative: getPromotionNarrative(home),
    stats: stateStore.getStats(home_id),
  });
}
