import assert from "node:assert/strict";
import { test } from "node:test";
import { choosePair, type PairFile } from "./pairing";

const file = (path: string, fileType: string): PairFile => ({ path, name: path.split("\\").pop() ?? "", fileType });

test("matching names win over folders", () => {
  const { board, pdf } = choosePair([
    file("D:\\a\\V371_21.cad", "BOARDVIEW"),
    file("D:\\a\\other sheet.pdf", "SCHEMATIC"),
    file("D:\\b\\V371_21_Decrypt.pdf", "SCHEMATIC"),
  ]);
  assert.equal(board?.name, "V371_21.cad");
  assert.equal(pdf?.name, "V371_21_Decrypt.pdf");
});

test("the same folder breaks a tie", () => {
  const { pdf } = choosePair([
    file("D:\\a\\board.cad", "BOARDVIEW"),
    file("D:\\b\\sheet.pdf", "SCHEMATIC"),
    file("D:\\a\\sheet.pdf", "SCHEMATIC"),
  ]);
  assert.equal(pdf?.path, "D:\\a\\sheet.pdf");
});

test("a schematic beats a boardview PDF", () => {
  const { pdf } = choosePair([
    file("D:\\a\\board.cad", "BOARDVIEW"),
    file("D:\\a\\print.pdf", "BOARDVIEW_PDF"),
    file("D:\\a\\sheet.pdf", "SCHEMATIC"),
  ]);
  assert.equal(pdf?.name, "sheet.pdf");
});

test("a board with only one side still opens", () => {
  assert.deepEqual(choosePair([file("D:\\a\\board.cad", "BOARDVIEW")]).pdf, null);
  assert.equal(choosePair([file("D:\\a\\sheet.pdf", "SCHEMATIC")]).board, null);
  assert.equal(choosePair([file("D:\\a\\sheet.pdf", "SCHEMATIC")]).pdf?.name, "sheet.pdf");
  assert.deepEqual(choosePair([]), { board: null, pdf: null });
});
