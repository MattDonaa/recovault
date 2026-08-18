/**
 * Auth constants with no Node-only dependencies, safe to import from the Edge
 * middleware (which must not pull in `node:crypto`).
 */
export const SESSION_COOKIE_NAME = "rv_session";
export const DEFAULT_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days
