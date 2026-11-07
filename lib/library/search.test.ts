import assert from "node:assert/strict";
import { test } from "node:test";
import { aliasesForModels, describeModel } from "./classify";
import { boardTitle, brandTree, closeMatches, compareGpus, filterBoards, gpuTree, type BoardSummary } from "./search";

function board(id: string, gpuModel: string, cardBrand: string, extra: Partial<BoardSummary> = {}): BoardSummary {
  return {
    id,
    gpuMaker: "NVIDIA",
    generation: `RTX ${gpuModel.match(/\d/)?.[0]}000`,
    gpuModel,
    cardBrand,
    cardName: "",
    boardCode: null,
    revision: "1.0",
    aliases: aliasesForModels([gpuModel], null, cardBrand),
    fileTypes: ["BOARDVIEW"],
    ...extra,
  };
}

const boards = [
  board("a", "RTX 5070", "Gigabyte"),
  board("b", "RTX 5070", "MSI"),
  board("c", "RTX 4090", "MSI", { boardCode: "MS-V510", fileTypes: ["SCHEMATIC", "BIOS"] }),
  board("d", "RTX 2080", "ASUS"),
  board("e", "RTX 10000", "MSI"),
  board("r", "Unidentified", "MSI", { gpuMaker: "Retro", generation: "Early graphics", boardCode: "MS-8989" }),
];

const ids = (list: BoardSummary[]) => list.map((b) => b.id);

test("every way of writing a GPU finds the same boards", () => {
  const expected = ["a", "b"];
  for (const q of ["RTX 5070", "RTX5070", "rtx-5070", "N5070"]) {
    assert.deepEqual(ids(filterBoards(boards, { q })), expected, q);
  }
});

test("each word filters across all fields", () => {
  assert.deepEqual(ids(filterBoards(boards, { q: "MSI 5070" })), ["b"]);
});

test("an exact board code comes first", () => {
  const withNeighbour = [...boards, board("f", "RTX 5090", "MSI", { aliases: ["MS-V510 notes"] })];
  assert.equal(filterBoards(withNeighbour, { q: "V510" })[0].id, "c");
  assert.equal(filterBoards(withNeighbour, { q: "MS-V510" })[0].id, "c");
});

test("the newest GPU comes first and numbers sort as numbers", () => {
  assert.deepEqual(ids(filterBoards(boards, {})), ["a", "b", "c", "d", "e"].sort((x, y) => "abcde".indexOf(x) - "abcde".indexOf(y)));
  assert.deepEqual(gpuTree(boards)[0].children.map((n) => n.label).slice(0, 3), ["RTX 5000", "RTX 4000", "RTX 2000"]);
});

test("retro boards stay out of the default view but can be found", () => {
  assert.ok(!ids(filterBoards(boards, {})).includes("r"));
  assert.deepEqual(ids(filterBoards(boards, { q: "MS-8989" })), ["r"]);
  assert.deepEqual(ids(filterBoards(boards, { maker: "Retro" })), ["r"]);
});

test("badge filters need every chosen file type", () => {
  assert.deepEqual(ids(filterBoards(boards, { has: ["schematic", "bios"] })), ["c"]);
  assert.deepEqual(ids(filterBoards(boards, { has: ["schematic", "boardview"] })), []);
});

test("a typing slip suggests close matches", () => {
  assert.deepEqual(filterBoards(boards, { q: "RTX 5071" }), []);
  assert.equal(closeMatches(boards, "RTX 5071")[0], "RTX 5070");
});

test("the brand view holds the same boards as the GPU view", () => {
  const count = (nodes: { count: number }[]) => nodes.reduce((sum, n) => sum + n.count, 0);
  assert.equal(count(gpuTree(boards)), boards.length);
  assert.equal(count(brandTree(boards)), boards.length);
  assert.equal(brandTree(boards)[0].label, "ASUS");
});

test("titles skip empty parts", () => {
  assert.equal(boardTitle({ cardBrand: "MSI", gpuModel: "RTX 4090", cardName: "" }), "MSI RTX 4090");
});

test("GPUs sort by age, not by the number in the name", () => {
  const models = ["HD 8570", "GTX 9800", "RTX 2080", "GTX 1660", "RX 9070 XT", "RTX 5090", "GTX 1080", "GTX 750", "R9 290"];
  assert.deepEqual([...models].sort(compareGpus), [
    "RX 9070 XT", "RTX 5090", "RTX 2080", "GTX 1660", "GTX 1080", "R9 290", "HD 8570", "GTX 750", "GTX 9800",
  ]);
});

test("old 4-digit GeForce names are not mistaken for the GTX 1600 family", () => {
  assert.equal(describeModel("GTX 9800").generation, "GTX 900 and older");
  assert.equal(describeModel("GTX 1660").generation, "GTX 1600");
});
