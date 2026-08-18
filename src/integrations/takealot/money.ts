import type { Money } from "@/core/marketplace/dto";

import { TAKEALOT_CURRENCY } from "@/integrations/takealot/config";

/**
 * Convert a Takealot ZAR amount (Rand; integer for prices, decimal for fees)
 * into canonical Money (integer minor units + currency). ZAR minor unit is the
 * cent, so minorUnits = round(rand * 100). Rounding avoids binary-float drift;
 * no floating point is retained downstream.
 */
export function randToMoney(
  rand: number,
  currency: string = TAKEALOT_CURRENCY,
): Money {
  return { minorUnits: Math.round(rand * 100), currency };
}

/** Subtract two Money values of the same currency (minor units). */
export function subtractMoney(a: Money, b: Money): Money {
  return { minorUnits: a.minorUnits - b.minorUnits, currency: a.currency };
}

/** Multiply a Money value by an integer quantity. */
export function multiplyMoney(a: Money, quantity: number): Money {
  return { minorUnits: a.minorUnits * quantity, currency: a.currency };
}
