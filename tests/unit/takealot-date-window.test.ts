import { describe, expect, it } from "vitest";

import { splitDateWindows } from "@/integrations/takealot/date-window";

const DAY = 86_400_000;

describe("splitDateWindows", () => {
  it("splits a range into contiguous windows with no gaps or overlap (date)", () => {
    const windows = splitDateWindows("2026-01-01", "2026-01-31", {
      windowDays: 7,
    });
    expect(windows[0]).toEqual({ gte: "2026-01-01", lte: "2026-01-07" });
    // Each window's start is exactly one day after the previous window's end.
    for (let i = 1; i < windows.length; i += 1) {
      const prevEnd = Date.parse(windows[i - 1]!.lte);
      const thisStart = Date.parse(windows[i]!.gte);
      expect(thisStart - prevEnd).toBe(DAY);
    }
    // Full coverage: first gte is the start, last lte is the end.
    expect(windows[0]!.gte).toBe("2026-01-01");
    expect(windows.at(-1)!.lte).toBe("2026-01-31");
  });

  it("covers every day exactly once (no gap, no overlap)", () => {
    const windows = splitDateWindows("2026-03-01", "2026-03-20", {
      windowDays: 6,
    });
    const days = new Set<string>();
    for (const w of windows) {
      let d = Date.parse(w.gte);
      const end = Date.parse(w.lte);
      while (d <= end) {
        const key = new Date(d).toISOString().slice(0, 10);
        expect(days.has(key)).toBe(false); // no overlap
        days.add(key);
        d += DAY;
      }
    }
    expect(days.size).toBe(20); // no gaps: 1..20 March inclusive
  });

  it("handles datetime granularity without overlap", () => {
    const windows = splitDateWindows(
      "2026-01-01T00:00:00.000Z",
      "2026-01-10T00:00:00.000Z",
      { windowDays: 3, granularity: "datetime" },
    );
    for (let i = 1; i < windows.length; i += 1) {
      const prevEnd = Date.parse(windows[i - 1]!.lte);
      const thisStart = Date.parse(windows[i]!.gte);
      expect(thisStart - prevEnd).toBe(1); // 1 ms apart
    }
    expect(windows[0]!.gte).toBe("2026-01-01T00:00:00.000Z");
    expect(windows.at(-1)!.lte).toBe("2026-01-10T00:00:00.000Z");
  });

  it("returns a single window when the range fits", () => {
    expect(
      splitDateWindows("2026-01-05", "2026-01-05", { windowDays: 30 }),
    ).toEqual([{ gte: "2026-01-05", lte: "2026-01-05" }]);
  });

  it("returns empty when start is after end", () => {
    expect(
      splitDateWindows("2026-02-01", "2026-01-01", { windowDays: 7 }),
    ).toEqual([]);
  });
});
