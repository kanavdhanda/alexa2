/**
 * Regime Engine — detects and manages home regime.
 * Zero AWS cost: all local computation, no network calls.
 */

import { stateStore } from './stateStore';
import type { HomeState, Regime } from './stateStore';

// ─── Festival calendar ────────────────────────────────────────────────────────

interface FestivalWindow {
  name: string;
  month: number;       // 1-12
  day_start: number;
  day_end: number;
}

const FESTIVAL_WINDOWS: FestivalWindow[] = [
  { name: 'Diwali',             month: 10, day_start: 20, day_end: 30 },
  { name: 'Holi',               month: 3,  day_start: 13, day_end: 18 },
  { name: 'Dussehra',           month: 10, day_start: 1,  day_end: 10 },
  { name: 'Navratri',           month: 10, day_start: 1,  day_end: 10 },
  { name: 'Christmas',          month: 12, day_start: 24, day_end: 26 },
  { name: 'New Year',           month: 1,  day_start: 1,  day_end: 2  },
  { name: 'Eid',                month: 3,  day_start: 30, day_end: 32 }, // approximate
  { name: 'Onam',               month: 8,  day_start: 26, day_end: 31 },
  { name: 'Pongal',             month: 1,  day_start: 14, day_end: 17 },
  { name: 'Ganesh Chaturthi',   month: 8,  day_start: 26, day_end: 35 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegimeDetectionResult {
  regime: Regime;
  confidence: number;
  reason: string;
  festival_name?: string;
  should_suppress_learning: boolean;  // true for festival/guest
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function checkFestival(now: Date): { match: boolean; festival_name?: string } {
  const month = now.getMonth() + 1; // 1-12
  const day   = now.getDate();

  for (const festival of FESTIVAL_WINDOWS) {
    if (festival.month === month && day >= festival.day_start && day <= festival.day_end) {
      return { match: true, festival_name: festival.name };
    }
  }
  return { match: false };
}

function checkGuest(home: HomeState, now: Date): boolean {
  const two_hours_ago = now.getTime() - 2 * 60 * 60 * 1000;

  return home.event_history.some(event => {
    if (!event.speaker_id) return false;
    const event_time = new Date(event.timestamp).getTime();
    if (event_time < two_hours_ago) return false;
    // Speaker present in recent history but not in known_speakers
    return !(event.speaker_id in home.known_speakers);
  });
}

function checkAway(home: HomeState, now: Date): boolean {
  const thirty_min_ago = now.getTime() - 30 * 60 * 1000;

  const rooms = Object.values(home.rooms);
  if (rooms.length === 0) return false;

  // All rooms must report unoccupied
  const all_unoccupied = rooms.every(room => !room.occupancy.occupied);
  if (!all_unoccupied) return false;

  // Every room's occupancy update must be older than 30 minutes
  // (i.e., they've been unoccupied for at least that long)
  return rooms.every(room => {
    const last_updated = new Date(room.occupancy.last_updated).getTime();
    return last_updated <= thirty_min_ago;
  });
}

function checkSleep(home: HomeState, now: Date): boolean {
  const hour = now.getHours();
  const is_sleep_hour = hour >= 22 || hour < 6;
  if (!is_sleep_hour) return false;

  // No voice command events in the last 45 minutes
  const forty_five_min_ago = now.getTime() - 45 * 60 * 1000;
  const recent_voice = home.event_history.some(event => {
    const event_time = new Date(event.timestamp).getTime();
    return event_time >= forty_five_min_ago && event.event_type === 'voice_command';
  });

  return !recent_voice;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detects the current home regime using local computation.
 * Priority order: festival > guest > sleep > away > normal
 */
export function detectRegime(home: HomeState): RegimeDetectionResult {
  const now = new Date();

  // 1. Festival check (highest priority)
  const festival = checkFestival(now);
  if (festival.match) {
    return {
      regime: 'festival',
      confidence: 0.95,
      reason: `Festival period: ${festival.festival_name}`,
      festival_name: festival.festival_name,
      should_suppress_learning: true,
    };
  }

  // 2. Guest check
  if (checkGuest(home, now)) {
    return {
      regime: 'guest',
      confidence: 0.85,
      reason: 'Unrecognised speaker detected in the last 2 hours',
      should_suppress_learning: true,
    };
  }

  // 3. Sleep check
  if (checkSleep(home, now)) {
    return {
      regime: 'sleep',
      confidence: 0.80,
      reason: 'Sleep hours (22:00–06:00) with no recent voice commands',
      should_suppress_learning: false,
    };
  }

  // 4. Away check
  if (checkAway(home, now)) {
    return {
      regime: 'away',
      confidence: 0.75,
      reason: 'All rooms unoccupied for more than 30 minutes',
      should_suppress_learning: false,
    };
  }

  // 5. Normal (default)
  return {
    regime: 'normal',
    confidence: 1.0,
    reason: 'No special conditions detected',
    should_suppress_learning: false,
  };
}

/**
 * Returns true for regimes where learning should be suppressed.
 * Per architecture spec §2.6: festival and guest suppress learning.
 */
export function shouldSuppressLearning(regime: Regime): boolean {
  return regime === 'festival' || regime === 'guest';
}

/**
 * Returns a short string describing the current regime,
 * suitable for injecting into LLM prompts.
 */
export function getRegimeContextNote(regime: Regime): string {
  switch (regime) {
    case 'festival':
      return 'REGIME NOTE: Festival period active. Learning is paused; do not promote new automations.';
    case 'guest':
      return 'REGIME NOTE: Guest present. Require explicit confirmation for personal or sensitive actions.';
    case 'sleep':
      return 'REGIME NOTE: Sleeping mode. Minimize notifications and keep all actuations quiet.';
    case 'away':
      return 'REGIME NOTE: Home is empty. Security is the top priority; flag any unexpected activity.';
    case 'normal':
    default:
      return 'REGIME NOTE: Normal operation.';
  }
}

/**
 * Detects the current regime for a home and updates the state store if it changed.
 */
export function updateHomeRegime(home_id: string): void {
  const home = stateStore.get(home_id);
  const result = detectRegime(home);

  if (home.current_regime !== result.regime) {
    stateStore.setRegime(home_id, result.regime, result.reason);
  }
}
