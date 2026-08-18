import type { ZodType, ZodTypeDef } from "zod";

/** A schema that accepts unknown input and yields output type T. */
type Schema<T> = ZodType<T, ZodTypeDef, unknown>;

/**
 * Fail-closed validation at the integration boundary. Invalid external payloads
 * are quarantined (retained raw, never normalized) rather than silently
 * coerced. Downstream code only ever sees validated canonical records.
 */

export interface QuarantinedRecord {
  kind: string;
  index: number;
  reason: string;
  raw: unknown;
}

export class MarketplacePayloadError extends Error {
  readonly quarantined: QuarantinedRecord[];
  constructor(quarantined: QuarantinedRecord[]) {
    super(`Marketplace payload validation failed (${quarantined.length})`);
    this.name = "MarketplacePayloadError";
    this.quarantined = quarantined;
  }
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

export function validateRecord<T>(
  schema: Schema<T>,
  raw: unknown,
): ValidationResult<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  const reason = parsed.error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return { ok: false, reason };
}

/**
 * Validate a batch of raw records. Valid records are normalized; invalid ones
 * are quarantined with their index and reason. Never throws for individual bad
 * records — callers decide how to surface quarantine.
 */
export function validateBatch<T>(
  kind: string,
  schema: Schema<T>,
  raws: readonly unknown[],
): { valid: T[]; quarantined: QuarantinedRecord[] } {
  const valid: T[] = [];
  const quarantined: QuarantinedRecord[] = [];
  raws.forEach((raw, index) => {
    const result = validateRecord(schema, raw);
    if (result.ok) valid.push(result.value);
    else quarantined.push({ kind, index, reason: result.reason, raw });
  });
  return { valid, quarantined };
}

/** Strict variant: throws MarketplacePayloadError if anything is invalid. */
export function validateBatchStrict<T>(
  kind: string,
  schema: Schema<T>,
  raws: readonly unknown[],
): T[] {
  const { valid, quarantined } = validateBatch(kind, schema, raws);
  if (quarantined.length > 0) throw new MarketplacePayloadError(quarantined);
  return valid;
}
