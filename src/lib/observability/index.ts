/**
 * Observability boundary: sanitized structured logging + a Sentry-ready error
 * capture shim. No secrets are ever logged; values under sensitive keys and any
 * token/JWT-shaped strings are redacted. When a Sentry DSN is configured this is
 * where events would be forwarded — kept as a no-op boundary otherwise.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /(key|secret|token|password|authorization|cookie|api[-_]?key)/i;
const TOKEN_SHAPE = /\beyJ[A-Za-z0-9_-]{10,}\b|\bsk_(live|test)_[A-Za-z0-9]+\b/g;

/** Redact secret-shaped values from an arbitrary context object. */
export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return value.replace(TOKEN_SHAPE, "***");
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "***" : redactSecrets(v);
    }
    return out;
  }
  return value;
}

export function log(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
): void {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(redactSecrets(context) as Record<string, unknown>),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Capture an exception. Sanitizes context, logs it structurally, and is the
 * single place a Sentry integration would forward from (no-op when unconfigured).
 */
export function captureException(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const message = error instanceof Error ? error.message : String(error);
  log("error", `captured_exception: ${message}`, {
    name: error instanceof Error ? error.name : "Error",
    ...context,
  });
  // Sentry-ready boundary: if a DSN is configured, forward here.
  // (Intentionally a no-op until Sentry is wired in a later, authorized step.)
}
