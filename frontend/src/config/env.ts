// Centralised, typed access to Vite environment variables.
// Import from this module — never read import.meta.env directly in components.

function optional(key: string, fallback: string): string {
  return (import.meta.env[key] as string | undefined) ?? fallback;
}

export const env = {
  // Base URL for all backend REST calls — no trailing slash
  BACKEND_URL: optional('VITE_BACKEND_URL', 'http://localhost:3001'),

  // Home ID used in every /homes/:home_id route
  HOME_ID: optional('VITE_HOME_ID', 'home_001'),

  // How often the frontend polls for anticipations / twin mode (ms)
  POLL_INTERVAL_MS: parseInt(optional('VITE_POLL_INTERVAL_MS', '30000'), 10),

  // Enable verbose request/response logging
  API_DEBUG: optional('VITE_API_DEBUG', 'false') === 'true',
} as const;
