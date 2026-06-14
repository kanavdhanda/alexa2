/**
 * Authorizer — Propose-authorize gate (architecture §5.6).
 * LLM proposes tool calls; this module validates them before execution.
 * Security centerpiece: no actuate_home_device call bypasses this gate.
 */

import { DeviceInstance, HomeState, Regime } from './stateStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthorizationContext {
  home_id: string;
  speaker_id?: string;
  speaker_role?: 'owner' | 'family' | 'guest' | 'child';
  identity_confidence: number;  // 0–1
  current_regime: Regime;
}

export interface AuthorizationResult {
  approved: boolean;
  reason: string;
  risk_class: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requires_confirmation: boolean;
  override_value?: any;  // e.g., budget cap
}

// ─── Noise-producing device types ─────────────────────────────────────────────

const NOISE_PRODUCING_TYPES = new Set(['fan', 'tv', 'speaker', 'music_system', 'vacuum']);

function wouldCreateNoise(device: DeviceInstance, tool_input: any): boolean {
  if (!NOISE_PRODUCING_TYPES.has(device.type)) return false;
  // Turning a device on, or setting volume/speed to nonzero would create noise
  const { property, value } = tool_input as { property?: string; value?: any };
  if (property === 'power' && value === true) return true;
  if (property === 'volume' && typeof value === 'number' && value > 0) return true;
  if (property === 'speed' && typeof value === 'number' && value > 0) return true;
  return false;
}

// ─── Authorizer ───────────────────────────────────────────────────────────────

export function authorizeTool(
  tool_name: string,
  tool_input: any,
  device: DeviceInstance | null,
  context: AuthorizationContext
): AuthorizationResult {

  // ── order_amazon_now ────────────────────────────────────────────────
  if (tool_name === 'order_amazon_now') {
    if (context.speaker_role === 'guest' || context.speaker_role === 'child') {
      return {
        approved: false,
        reason: 'Guests and children cannot place orders.',
        risk_class: 'HIGH',
        requires_confirmation: false,
      };
    }

    if (context.identity_confidence < 0.7) {
      return {
        approved: false,
        reason: 'Identity not confirmed for commerce action. Please re-authenticate.',
        risk_class: 'HIGH',
        requires_confirmation: false,
      };
    }

    const requested_budget: number = (tool_input as any)?.max_budget ?? 0;
    if (requested_budget > 500) {
      return {
        approved: true,
        reason: `Budget capped at ₹500 INR (requested ₹${requested_budget}).`,
        risk_class: 'MEDIUM',
        requires_confirmation: true,
        override_value: 500,
      };
    }

    return {
      approved: true,
      reason: 'Order approved within budget limits.',
      risk_class: 'MEDIUM',
      requires_confirmation: true,
    };
  }

  // ── actuate_home_device ─────────────────────────────────────────────
  if (tool_name === 'actuate_home_device') {
    if (device === null) {
      return {
        approved: false,
        reason: 'Target device not found in home state.',
        risk_class: 'MEDIUM',
        requires_confirmation: false,
      };
    }

    // Sleep regime noise guard
    if (context.current_regime === 'sleep' && wouldCreateNoise(device, tool_input)) {
      return {
        approved: false,
        reason: `Cannot activate ${device.type} during sleep regime — it would create noise.`,
        risk_class: 'MEDIUM',
        requires_confirmation: false,
      };
    }

    // CRITICAL safety class
    if (device.safety_class === 'CRITICAL') {
      if (context.speaker_role === 'guest') {
        return {
          approved: false,
          reason: 'Guests cannot control safety-critical devices.',
          risk_class: 'CRITICAL',
          requires_confirmation: false,
        };
      }

      if (context.identity_confidence < 0.6) {
        return {
          approved: true,
          reason: 'Low identity confidence — explicit confirmation required for critical device.',
          risk_class: 'CRITICAL',
          requires_confirmation: true,
        };
      }

      return {
        approved: true,
        reason: 'Critical device actuation approved for identified user.',
        risk_class: 'CRITICAL',
        requires_confirmation: true,
      };
    }

    // STANDARD safety class
    if (device.safety_class === 'STANDARD') {
      return {
        approved: true,
        reason: 'Standard device actuation approved.',
        risk_class: 'MEDIUM',
        requires_confirmation: false,
      };
    }

    // CONVENIENCE safety class
    return {
      approved: true,
      reason: 'Convenience device — auto-approved.',
      risk_class: 'LOW',
      requires_confirmation: false,
    };
  }

  // ── log_new_sound_cluster ───────────────────────────────────────────
  if (tool_name === 'log_new_sound_cluster') {
    return {
      approved: true,
      reason: 'Sound cluster logging is always permitted.',
      risk_class: 'LOW',
      requires_confirmation: false,
    };
  }

  // ── send_user_notification ──────────────────────────────────────────
  if (tool_name === 'send_user_notification') {
    const notification_type: string = ((tool_input as any)?.type ?? 'INFO').toUpperCase();

    if (context.current_regime === 'sleep') {
      if (notification_type === 'ALERT' || notification_type === 'WARNING') {
        return {
          approved: true,
          reason: 'Alert/warning notifications permitted even during sleep regime.',
          risk_class: 'LOW',
          requires_confirmation: false,
        };
      }
      // INFO and other types suppressed during sleep
      return {
        approved: false,
        reason: `INFO notifications suppressed during sleep regime.`,
        risk_class: 'LOW',
        requires_confirmation: false,
      };
    }

    return {
      approved: true,
      reason: 'Notification approved.',
      risk_class: 'LOW',
      requires_confirmation: false,
    };
  }

  // ── Unknown tool ────────────────────────────────────────────────────
  return {
    approved: false,
    reason: `Unknown tool "${tool_name}" — rejected by default.`,
    risk_class: 'HIGH',
    requires_confirmation: false,
  };
}

// ─── Batch authorizer ─────────────────────────────────────────────────────────

export function authorizeToolBatch(
  tool_calls: Array<{ tool_name: string; tool_input: any }>,
  homeState: HomeState,
  context: AuthorizationContext
): Array<{ tool_name: string; tool_input: any; authorization: AuthorizationResult }> {
  return tool_calls.map((call) => {
    let device: DeviceInstance | null = null;

    if (call.tool_name === 'actuate_home_device') {
      const device_id: string | undefined = (call.tool_input as any)?.device_id;
      if (device_id) {
        device = homeState.devices[device_id] ?? null;
      }
    }

    const authorization = authorizeTool(
      call.tool_name,
      call.tool_input,
      device,
      context
    );

    return { ...call, authorization };
  });
}
