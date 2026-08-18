import { describe, expect, it } from "vitest";

import { hashPayload, stableStringify } from "@/core/ingestion/hash";

describe("ingestion hashing", () => {
  it("is stable regardless of key order", () => {
    expect(hashPayload({ a: 1, b: 2 })).toBe(hashPayload({ b: 2, a: 1 }));
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("differs when the payload changes", () => {
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it("handles nested objects and arrays deterministically", () => {
    const one = { x: [{ q: 1, p: 2 }], y: { d: 4, c: 3 } };
    const two = { y: { c: 3, d: 4 }, x: [{ p: 2, q: 1 }] };
    expect(hashPayload(one)).toBe(hashPayload(two));
  });
});
