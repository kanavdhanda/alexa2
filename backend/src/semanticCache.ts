/**
 * SemanticCache — Prevents duplicate Bedrock calls during demos.
 * Pure in-memory, zero AWS cost. Keyed on normalized event data using djb2 hash.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  key: string;
  result: any;
  hit_count: number;
  created_at: number;   // Date.now()
  last_hit_at: number;
  ttl_ms: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** djb2 hash — fast, deterministic, good enough for cache keys. */
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 ^ charCode
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep as unsigned 32-bit
  }
  return hash.toString(36);
}

const TIMESTAMP_FIELDS = new Set(['ts', 'timestamp', 'time', 'received_at']);

/** Recursively normalize a value: sort object keys, lowercase strings, drop timestamp fields. */
function normalizeValue(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return v.toLowerCase();
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (typeof v === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) {
      if (TIMESTAMP_FIELDS.has(k)) continue;
      out[k] = normalizeValue(v[k]);
    }
    return out;
  }
  return v;
}

export function buildCacheKey(event_type: string, data: Record<string, any>): string {
  const normalized = normalizeValue(data);
  const serialized = JSON.stringify(normalized);
  const hash = djb2(serialized);
  return `${event_type.toLowerCase()}:${hash}`;
}

// ─── SemanticCache class ──────────────────────────────────────────────────────

export class SemanticCache {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_ENTRIES = 100;
  private readonly DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

  /** Return cached result, or null if missing / expired. Increments hit_count. */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.created_at > entry.ttl_ms) {
      // Expired — evict and return null
      this.cache.delete(key);
      return null;
    }

    entry.hit_count++;
    entry.last_hit_at = now;
    return entry.result;
  }

  /** Store a result. Evicts the oldest entry if MAX_ENTRIES would be exceeded. */
  set(key: string, result: any, ttl_ms?: number): void {
    if (this.cache.size >= this.MAX_ENTRIES && !this.cache.has(key)) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      key,
      result,
      hit_count: 0,
      created_at: now,
      last_hit_at: now,
      ttl_ms: ttl_ms ?? this.DEFAULT_TTL_MS,
    });
  }

  /** Remove a specific key from the cache. */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /** Flush the entire cache. */
  clear(): void {
    this.cache.clear();
  }

  /** Aggregate stats for observability. */
  getStats(): { size: number; total_hits: number; keys: string[] } {
    let total_hits = 0;
    for (const entry of this.cache.values()) {
      total_hits += entry.hit_count;
    }
    return {
      size: this.cache.size,
      total_hits,
      keys: Array.from(this.cache.keys()),
    };
  }

  // ── Private ────────────────────────────────────────────────────────

  /** Evict the entry with the oldest created_at timestamp. */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, entry] of this.cache.entries()) {
      if (entry.created_at < oldestTime) {
        oldestTime = entry.created_at;
        oldestKey = k;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const semanticCache = new SemanticCache();
