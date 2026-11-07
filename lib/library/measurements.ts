import { naturalCompare } from "./normalise";

export const MODES = ["DIODE", "RESISTANCE", "VOLTAGE"] as const;
export const POLARITIES = ["RED_ON_GROUND", "BLACK_ON_GROUND", "NOT_APPLICABLE"] as const;
export const CONDITIONS = ["GOOD", "FAULTY"] as const;

export type Mode = (typeof MODES)[number];

export type Reading = {
  target: string;
  mode: string;
  polarity: string;
  condition: string;
  value: number | null; // volts or ohms, null when the meter reads open (OL)
};

export type Spread = { count: number; open: number; min: number | null; max: number | null; median: number | null };

export type ReadingRow = { target: string; mode: string; polarity: string; good: Spread; faulty: Spread };

function spread(values: (number | null)[]): Spread {
  const numbers = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  const middle = Math.floor(numbers.length / 2);
  return {
    count: values.length,
    open: values.length - numbers.length,
    min: numbers[0] ?? null,
    max: numbers[numbers.length - 1] ?? null,
    median: !numbers.length
      ? null
      : numbers.length % 2
        ? numbers[middle]
        : (numbers[middle - 1] + numbers[middle]) / 2,
  };
}

/** One row per net, mode and polarity, because readings only compare within those. */
export function summarise(readings: Reading[]): ReadingRow[] {
  const groups = new Map<string, Reading[]>();
  for (const reading of readings) {
    const key = [reading.target.toUpperCase(), reading.mode, reading.polarity].join("|");
    groups.set(key, [...(groups.get(key) ?? []), reading]);
  }
  return [...groups.values()]
    .map((group) => ({
      target: group[0].target.toUpperCase(),
      mode: group[0].mode,
      polarity: group[0].polarity,
      good: spread(group.filter((r) => r.condition === "GOOD").map((r) => r.value)),
      faulty: spread(group.filter((r) => r.condition === "FAULTY").map((r) => r.value)),
    }))
    .sort(
      (a, b) =>
        naturalCompare(a.target, b.target) ||
        MODES.indexOf(a.mode as Mode) - MODES.indexOf(b.mode as Mode) ||
        naturalCompare(a.polarity, b.polarity)
    );
}

const trim = (value: number, digits: number) => String(Number(value.toFixed(digits)));

export function formatValue(value: number | null, mode: string): string {
  if (value === null) return "OL";
  if (mode === "RESISTANCE") {
    if (Math.abs(value) >= 1e6) return `${trim(value / 1e6, 2)} MΩ`;
    if (Math.abs(value) >= 1000) return `${trim(value / 1000, 2)} kΩ`;
    return `${trim(value, 2)} Ω`;
  }
  return `${trim(value, 3)} V`;
}

/** The range, never a single number unless only one value exists. */
export function formatSpread(s: Spread, mode: string): string {
  if (!s.count) return "";
  const parts: string[] = [];
  if (s.min !== null && s.max !== null) {
    parts.push(s.min === s.max ? formatValue(s.min, mode) : `${formatValue(s.min, mode)} to ${formatValue(s.max, mode)}`);
  }
  if (s.open) parts.push(s.min === null ? "OL" : `OL ×${s.open}`);
  return parts.join(", ");
}

const UNIT_FACTOR: Record<string, number> = { V: 1, mV: 0.001, ohm: 1, kohm: 1000, Mohm: 1e6 };

/** Turns what was typed into volts or ohms. Null means it could not be read. */
export function parseReading(raw: string, unit: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text) || !(unit in UNIT_FACTOR)) return null;
  return Number((Number(text) * UNIT_FACTOR[unit]).toFixed(6));
}
