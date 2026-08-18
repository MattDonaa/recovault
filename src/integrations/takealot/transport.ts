import {
  classifyStatus,
  redactSecret,
  sanitizeErrorMessage,
  TakealotApiError,
} from "@/integrations/takealot/errors";
import {
  TAKEALOT_API_KEY_HEADER,
  TAKEALOT_BASE_URL,
} from "@/integrations/takealot/config";

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue | QueryValue[]>;

/** A minimal fetch signature so tests can inject a mock HTTP layer. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string> },
) => Promise<{
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface TakealotTransportOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

/**
 * HTTP transport for the Takealot API. Injects the `X-API-Key` header (the
 * single place authentication is applied), and converts non-2xx responses into
 * sanitized `TakealotApiError`s. The key is never logged, echoed, or placed in
 * an error/message.
 */
export class TakealotTransport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: TakealotTransportOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? TAKEALOT_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as FetchLike);
  }

  private buildUrl(path: string, query?: Query): string {
    const url = new URL(
      path.startsWith("/") ? path.slice(1) : path,
      this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`,
    );
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) {
            if (v !== null && v !== undefined) {
              url.searchParams.append(key, String(v));
            }
          }
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async get(path: string, query?: Query): Promise<unknown> {
    const url = this.buildUrl(path, query);
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          [TAKEALOT_API_KEY_HEADER]: this.apiKey,
          Accept: "application/json",
        },
      });
    } catch (cause) {
      // Never surface the underlying error text unredacted.
      const msg = redactSecret(
        cause instanceof Error ? cause.message : "request failed",
        this.apiKey,
      );
      throw new TakealotApiError("network", null, `Takealot request failed: ${msg}`);
    }

    if (!response.ok) {
      const code = classifyStatus(response.status);
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      throw new TakealotApiError(
        code,
        response.status,
        sanitizeErrorMessage(code, body, this.apiKey),
      );
    }

    return response.json();
  }
}
