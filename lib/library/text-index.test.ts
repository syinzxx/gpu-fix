import assert from "node:assert/strict";
import { test } from "node:test";
import { extractTerms, findHashes, looksScanned, matchQuery, openIndex, saveFile } from "./text-index";

test("technical terms are kept and ordinary words dropped", () => {
  const terms = extractTerms("The controller UP9512PQGJ drives NVVDD and FBVDDQ_GND_SENSE with GDDR6 memory, see PEX_RST# and C240.");
  for (const wanted of ["UP9512PQGJ", "NVVDD", "FBVDDQ_GND_SENSE", "GDDR6", "PEX_RST#", "C240"]) {
    assert.ok(terms.includes(wanted), wanted);
  }
  for (const unwanted of ["THE", "CONTROLLER", "MEMORY", "DRIVES"]) assert.ok(!terms.includes(unwanted), unwanted);
});

test("each term is stored once and trailing punctuation goes", () => {
  assert.deepEqual(extractTerms("RT8843A RT8843A. rt8843a"), ["RT8843A"]);
});

test("pages with almost no text count as scanned", () => {
  assert.equal(looksScanned(10, 100), true);
  assert.equal(looksScanned(10, 50000), false);
  assert.equal(looksScanned(0, 0), false);
});

test("short words are left out of the query, and quotes cannot break it", () => {
  assert.equal(matchQuery("MP2888"), '"MP2888"*');
  assert.equal(matchQuery("a MP2888 FBVDDQ"), '"MP2888"* AND "FBVDDQ"*');
  assert.equal(matchQuery('MP"2888'), '"MP2888"*');
  assert.equal(matchQuery("ab"), null);
});

test("searching finds exact terms, prefixes and dashed names, in any case", () => {
  const db = openIndex(":memory:");
  saveFile(db, "aaa", "OK", 10, 5000, "a.pdf", ["UP9512PQGJ", "GDDR6", "FBVDDQ_GND_SENSE", "NVVDD-PH1"]);
  saveFile(db, "bbb", "OK", 10, 5000, "b.pdf", ["MP2888A", "GDDR6X"]);
  saveFile(db, "ccc", "SCANNED", 10, 5, "c.pdf", []);
  assert.deepEqual(findHashes(db, "UP9512"), ["aaa"]);
  assert.deepEqual(findHashes(db, "mp2888"), ["bbb"]);
  assert.deepEqual(findHashes(db, "FBVDDQ_GND"), ["aaa"]);
  assert.deepEqual(findHashes(db, "NVVDD-PH1"), ["aaa"]);
  assert.deepEqual(findHashes(db, "GDDR6").sort(), ["aaa", "bbb"]);
  assert.deepEqual(findHashes(db, "GDDR6 UP9512"), ["aaa"]);
  assert.deepEqual(findHashes(db, "NOPE999"), []);
  db.close();
});

test("saving a file again replaces its terms", () => {
  const db = openIndex(":memory:");
  saveFile(db, "aaa", "OK", 1, 100, "a.pdf", ["OLD111"]);
  saveFile(db, "aaa", "OK", 1, 100, "a.pdf", ["NEW222"]);
  assert.deepEqual(findHashes(db, "OLD111"), []);
  assert.deepEqual(findHashes(db, "NEW222"), ["aaa"]);
  db.close();
});
