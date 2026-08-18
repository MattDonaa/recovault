import { describe, expect, it } from "vitest";

import { collectAll, type Page } from "@/core/marketplace/pagination";

function pagedSource(total: number, pageSize: number) {
  return (cursor: string | null): Promise<Page<number>> => {
    const start = cursor ? Number(cursor) : 0;
    const records = [];
    for (let i = start; i < Math.min(start + pageSize, total); i += 1) {
      records.push(i);
    }
    const nextIndex = start + pageSize;
    return Promise.resolve({
      records,
      nextCursor: nextIndex < total ? String(nextIndex) : null,
      quarantined: [],
    });
  };
}

describe("collectAll pagination", () => {
  it("returns every record exactly once across pages", async () => {
    const { records } = await collectAll(pagedSource(137, 20));
    expect(records).toHaveLength(137);
    expect(new Set(records).size).toBe(137);
    expect(records[0]).toBe(0);
    expect(records.at(-1)).toBe(136);
  });

  it("handles an empty source cleanly", async () => {
    const { records, quarantined } = await collectAll(pagedSource(0, 20));
    expect(records).toEqual([]);
    expect(quarantined).toEqual([]);
  });

  it("handles an exact page-size boundary", async () => {
    const { records } = await collectAll(pagedSource(40, 20));
    expect(records).toHaveLength(40);
  });
});
