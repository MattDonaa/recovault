import type { QuarantinedRecord } from "@/core/marketplace/validation";

/**
 * Marketplace-agnostic pagination. Concrete marketplaces differ (continuation
 * tokens, page numbers, offsets); adapters hide that behind an opaque cursor.
 * A null `nextCursor` marks the end. Every record is yielded exactly once.
 */
export interface ListParams {
  cursor?: string | null;
  pageSize?: number;
}

export interface Page<T> {
  records: T[];
  nextCursor: string | null;
  /** Raw records rejected at the boundary (fail-closed), never normalized. */
  quarantined: QuarantinedRecord[];
}

export const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES = 100_000;

/**
 * Drain a paginated source completely, following cursors until exhausted.
 * Accumulates records and quarantined entries. A hard page cap prevents
 * infinite loops from a misbehaving cursor.
 */
export async function collectAll<T>(
  fetchPage: (cursor: string | null) => Promise<Page<T>>,
): Promise<{ records: T[]; quarantined: QuarantinedRecord[] }> {
  const records: T[] = [];
  const quarantined: QuarantinedRecord[] = [];
  let cursor: string | null = null;
  let pages = 0;

  do {
    const page: Page<T> = await fetchPage(cursor);
    records.push(...page.records);
    quarantined.push(...page.quarantined);
    cursor = page.nextCursor;
    pages += 1;
    if (pages > MAX_PAGES) {
      throw new Error("Pagination exceeded maximum page count");
    }
  } while (cursor !== null);

  return { records, quarantined };
}
