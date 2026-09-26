import { describe, expect, it } from "vitest";
import { displayToSqft, formatArea, setFormatPrefs, sqftToDisplay } from "./format-prefs";

describe("area format", () => {
  it("converts stored square feet to square meters for display", () => {
    setFormatPrefs({ language: "es", dateFormat: "dd/MM/yyyy", areaUnit: "m2" });
    expect(sqftToDisplay(1450, "m2")).toBeCloseTo(134.7, 1);
    expect(displayToSqft(134.7, "m2")).toBe(1450);
    expect(formatArea(1450, "m2")).toBe("134.7 m²");
  });
});
