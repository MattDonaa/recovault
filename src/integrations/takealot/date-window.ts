/**
 * Deterministic date-window splitting for historical sync of date-ranged
 * endpoints (sales, returns, transactions). Produces contiguous, inclusive
 * windows that never overlap and never leave a gap, so a full history can be
 * fetched window-by-window without double-counting or missing records.
 */
export interface DateWindow {
  gte: string;
  lte: string;
}

export type DateGranularity = "date" | "datetime";

const DAY_MS = 86_400_000;

function format(ms: number, granularity: DateGranularity): string {
  const iso = new Date(ms).toISOString();
  return granularity === "date" ? iso.slice(0, 10) : iso;
}

/**
 * Split [start, end] into windows of at most `windowDays`. Consecutive windows
 * are separated by exactly one unit (1 day for "date", 1 ms for "datetime"),
 * guaranteeing no overlap and no gap. Returns [] if start is after end.
 */
export function splitDateWindows(
  start: string,
  end: string,
  options: { windowDays: number; granularity?: DateGranularity },
): DateWindow[] {
  const granularity = options.granularity ?? "date";
  const unitMs = granularity === "date" ? DAY_MS : 1;
  const windowMs = Math.max(1, Math.floor(options.windowDays)) * DAY_MS;

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error("splitDateWindows: invalid start/end date");
  }
  if (startMs > endMs) return [];

  const windows: DateWindow[] = [];
  let cursor = startMs;
  // Guard against pathological inputs.
  let guard = 0;
  const maxWindows = 100_000;
  while (cursor <= endMs) {
    const windowEnd = Math.min(cursor + windowMs - unitMs, endMs);
    windows.push({
      gte: format(cursor, granularity),
      lte: format(windowEnd, granularity),
    });
    cursor = windowEnd + unitMs;
    guard += 1;
    if (guard > maxWindows) {
      throw new Error("splitDateWindows: exceeded maximum window count");
    }
  }
  return windows;
}
