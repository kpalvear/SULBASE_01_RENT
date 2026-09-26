export type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export type AreaUnit = "m2" | "ft2";

export type FormatPrefs = {
  language: "es" | "en";
  dateFormat: DateFormat;
  areaUnit: AreaUnit;
};

const prefs: FormatPrefs = {
  language: "es",
  dateFormat: "dd/MM/yyyy",
  areaUnit: "m2",
};

export function setFormatPrefs(next: FormatPrefs): void {
  prefs.language = next.language;
  prefs.dateFormat = next.dateFormat;
  prefs.areaUnit = next.areaUnit;
}

export function getFormatPrefs(): FormatPrefs {
  return { language: prefs.language, dateFormat: prefs.dateFormat, areaUnit: prefs.areaUnit };
}

const SQFT_PER_M2 = 10.76391041671;

export function sqftToDisplay(sqft: number, unit: AreaUnit = prefs.areaUnit): number {
  if (unit === "ft2") return sqft;
  return Math.round((sqft / SQFT_PER_M2) * 10) / 10;
}

export function displayToSqft(value: number, unit: AreaUnit = prefs.areaUnit): number {
  if (unit === "ft2") return Math.round(value);
  return Math.round(value * SQFT_PER_M2);
}

export function formatArea(sqft: number | null | undefined, unit: AreaUnit = prefs.areaUnit): string {
  if (sqft == null || Number.isNaN(sqft)) return "";
  const shown = sqftToDisplay(sqft, unit);
  return unit === "m2" ? `${shown} m²` : `${Math.round(shown)} ft²`;
}
