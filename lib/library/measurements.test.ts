import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSpread, formatValue, parseReading, summarise, type Reading } from "./measurements";

const reading = (value: number | null, condition = "GOOD", target = "FBVDDQ", mode = "DIODE", polarity = "RED_ON_GROUND"): Reading => ({
  target, mode, polarity, condition, value,
});

test("readings show as a range with a count, split by condition", () => {
  const [row] = summarise([reading(0.31), reading(0.34), reading(0.32), reading(0.01, "FAULTY")]);
  assert.equal(row.good.count, 3);
  assert.equal(row.good.min, 0.31);
  assert.equal(row.good.max, 0.34);
  assert.equal(row.good.median, 0.32);
  assert.equal(row.faulty.count, 1);
  assert.equal(row.faulty.min, 0.01);
});

test("an even number of readings uses the middle two for the median", () => {
  assert.ok(Math.abs((summarise([reading(1), reading(2), reading(3), reading(4)])[0].good.median ?? 0) - 2.5) < 1e-9);
});

test("readings only compare within the same net, mode and polarity", () => {
  const rows = summarise([
    reading(0.3),
    reading(0.5, "GOOD", "FBVDDQ", "DIODE", "BLACK_ON_GROUND"),
    reading(120, "GOOD", "FBVDDQ", "RESISTANCE", "NOT_APPLICABLE"),
    reading(0.4, "GOOD", "NVVDD"),
  ]);
  assert.equal(rows.length, 4);
});

test("net names group regardless of case and sort naturally", () => {
  const rows = summarise([reading(1, "GOOD", "U10"), reading(1, "GOOD", "u2"), reading(2, "GOOD", "U2")]);
  assert.deepEqual(rows.map((r) => r.target), ["U2", "U10"]);
  assert.equal(rows[0].good.count, 2);
});

test("OL counts as a reading but not as a number", () => {
  const [row] = summarise([reading(null), reading(0.5), reading(0.6)]);
  assert.equal(row.good.count, 3);
  assert.equal(row.good.open, 1);
  assert.equal(row.good.max, 0.6);
  assert.equal(formatSpread(row.good, "DIODE"), "0.5 V to 0.6 V, OL ×1");
  assert.equal(formatSpread(summarise([reading(null)])[0].good, "DIODE"), "OL");
  assert.equal(formatSpread(summarise([reading(0.3)])[0].faulty, "DIODE"), "");
});

test("values read in the right units", () => {
  assert.equal(formatValue(0.312, "DIODE"), "0.312 V");
  assert.equal(formatValue(0.8, "RESISTANCE"), "0.8 Ω");
  assert.equal(formatValue(4700, "RESISTANCE"), "4.7 kΩ");
  assert.equal(formatValue(2200000, "RESISTANCE"), "2.2 MΩ");
  assert.equal(formatValue(null, "RESISTANCE"), "OL");
});

test("typed values convert to volts or ohms, and rubbish is refused", () => {
  assert.equal(parseReading("0.312", "V"), 0.312);
  assert.equal(parseReading("312", "mV"), 0.312);
  assert.equal(parseReading("0,312", "V"), 0.312);
  assert.equal(parseReading("4.7", "kohm"), 4700);
  assert.equal(parseReading("-1.8", "V"), -1.8);
  assert.equal(parseReading("abc", "V"), null);
  assert.equal(parseReading("", "V"), null);
  assert.equal(parseReading("1", "furlong"), null);
});
