import { Request, Response } from 'express';
import { stateStore } from '../stateStore';
import { detectRegime, shouldSuppressLearning, updateHomeRegime } from '../regimeEngine';
import { wsServer } from '../websocket';

export function getRegime(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const home = stateStore.get(home_id);
  const detection = detectRegime(home);
  return res.json({
    home_id,
    current_regime: home.current_regime,
    detection,
    learning_suppressed: shouldSuppressLearning(home.current_regime),
    regime_history: home.regime_history.slice(0, 10),
  });
}

export function forceRegime(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const { regime, reason = 'manual override' } = req.body;
  const valid = ['normal', 'festival', 'guest', 'sleep', 'away'];
  if (!valid.includes(regime)) return res.status(400).json({ error: `Invalid regime. Choose from: ${valid.join(', ')}` });

  stateStore.setRegime(home_id, regime, reason);
  wsServer?.broadcastRegimeChange(home_id, regime, reason);

  return res.json({ home_id, new_regime: regime, reason, learning_suppressed: shouldSuppressLearning(regime) });
}

export function refreshRegime(req: Request, res: Response) {
  const home_id = req.params['home_id'] as string;
  const before = stateStore.get(home_id).current_regime;
  updateHomeRegime(home_id);
  const after = stateStore.get(home_id).current_regime;
  if (before !== after) wsServer?.broadcastRegimeChange(home_id, after, 'auto-detected');
  return res.json({ home_id, previous_regime: before, current_regime: after, changed: before !== after });
}
