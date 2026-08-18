import { describe, expect, it } from "vitest";

import {
  multiplyMoney,
  randToMoney,
  subtractMoney,
} from "@/integrations/takealot/money";

describe("takealot money", () => {
  it("converts ZAR rand to integer minor units (cents)", () => {
    expect(randToMoney(345)).toEqual({ minorUnits: 34500, currency: "ZAR" });
    expect(randToMoney(15.75)).toEqual({ minorUnits: 1575, currency: "ZAR" });
    expect(randToMoney(15000.5)).toEqual({ minorUnits: 1500050, currency: "ZAR" });
  });

  it("rounds to the nearest cent (no float drift)", () => {
    expect(randToMoney(0.1 + 0.2).minorUnits).toBe(30);
    expect(randToMoney(2.005).minorUnits).toBe(201);
  });

  it("subtracts and multiplies in minor units", () => {
    expect(subtractMoney(randToMoney(100), randToMoney(15.75)).minorUnits).toBe(8425);
    expect(multiplyMoney(randToMoney(199), 3).minorUnits).toBe(59700);
  });
});
