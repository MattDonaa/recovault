/**
 * Sanitized error handling for the Takealot adapter. Error objects never carry
 * the API key or raw request headers, and all outward text is scrubbed of the
 * key as defense in depth.
 */
export type TakealotErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "rate_limited"
  | "server"
  | "network"
  | "unknown";

export class TakealotApiError extends Error {
  readonly code: TakealotErrorCode;
  readonly status: number | null;
  constructor(code: TakealotErrorCode, status: number | null, message: string) {
    super(message);
    this.name = "TakealotApiError";
    this.code = code;
    this.status = status;
  }
}

export function classifyStatus(status: number): TakealotErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 422 || status === 400) return "validation";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}

/** Replace any occurrence of the secret with a redaction marker. */
export function redactSecret(text: string, secret: string | undefined): string {
  if (!secret) return text;
  return text.split(secret).join("***REDACTED***");
}

/**
 * Build a short, non-sensitive message from a parsed error body. Only known
 * documented fields (message/title) are used; never headers or the key.
 */
export function sanitizeErrorMessage(
  code: TakealotErrorCode,
  body: unknown,
  secret: string | undefined,
): string {
  let detail = "";
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") detail = b.message;
    else if (typeof b.title === "string") detail = b.title;
  }
  const base = `Takealot API error (${code})`;
  const text = detail ? `${base}: ${detail}` : base;
  return redactSecret(text, secret).slice(0, 300);
}
