import { describe, expect, it } from "vitest";

import { TakealotApiError } from "@/integrations/takealot/errors";
import { TakealotTransport, type FetchLike } from "@/integrations/takealot/transport";
import { sellerPayload } from "../fixtures/takealot-payloads";

const KEY = "super-secret-takealot-key-DO-NOT-LEAK";

function jsonResponse(status: number, body: unknown): ReturnType<FetchLike> {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("takealot transport", () => {
  it("injects the X-API-Key header on requests", async () => {
    let seenHeaders: Record<string, string> = {};
    const fetchImpl: FetchLike = (_url, init) => {
      seenHeaders = init.headers;
      return jsonResponse(200, sellerPayload);
    };
    const t = new TakealotTransport({ apiKey: KEY, fetchImpl });
    await t.get("/seller");
    expect(seenHeaders["X-API-Key"]).toBe(KEY);
  });

  it("builds query strings, skipping null/undefined", async () => {
    let seenUrl = "";
    const fetchImpl: FetchLike = (url) => {
      seenUrl = url;
      return jsonResponse(200, { items: [] });
    };
    const t = new TakealotTransport({ apiKey: KEY, fetchImpl });
    await t.get("/offers", { limit: 50, continuation_token: undefined, status: "buyable" });
    expect(seenUrl).toContain("limit=50");
    expect(seenUrl).toContain("status=buyable");
    expect(seenUrl).not.toContain("continuation_token");
  });

  it("throws a sanitized forbidden error without leaking the key", async () => {
    const fetchImpl: FetchLike = () => jsonResponse(403, { errors: [{ message: "Access denied" }] });
    const t = new TakealotTransport({ apiKey: KEY, fetchImpl });
    const err = await t.get("/seller").catch((e) => e);
    expect(err).toBeInstanceOf(TakealotApiError);
    expect((err as TakealotApiError).code).toBe("forbidden");
    expect((err as TakealotApiError).status).toBe(403);
    // Key must never appear anywhere in the error.
    expect(JSON.stringify(err)).not.toContain(KEY);
    expect((err as TakealotApiError).message).not.toContain(KEY);
  });

  it("classifies 404 as not_found", async () => {
    const fetchImpl: FetchLike = () => jsonResponse(404, { message: "not found" });
    const t = new TakealotTransport({ apiKey: KEY, fetchImpl });
    const err = await t.get("/returns/1").catch((e) => e);
    expect((err as TakealotApiError).code).toBe("not_found");
  });

  it("redacts the key even if the underlying transport error contains it", async () => {
    const fetchImpl: FetchLike = () => {
      throw new Error(`connection to host with key ${KEY} failed`);
    };
    const t = new TakealotTransport({ apiKey: KEY, fetchImpl });
    const err = await t.get("/seller").catch((e) => e);
    expect((err as TakealotApiError).code).toBe("network");
    expect((err as TakealotApiError).message).not.toContain(KEY);
    expect((err as TakealotApiError).message).toContain("***REDACTED***");
  });
});
