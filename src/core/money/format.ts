/**
 * Format an exact integer minor-unit amount for display. The value is kept in
 * integer minor units end-to-end; only the final presentation divides by 100.
 */
export function formatMoneyMinor(
  minorUnits: number | null,
  currency: string | null,
): string {
  if (minorUnits === null || currency === null) return "—";
  const major = minorUnits / 100;
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(major);
  } catch {
    // Unknown currency code → deterministic fallback.
    return `${currency} ${major.toFixed(2)}`;
  }
}
