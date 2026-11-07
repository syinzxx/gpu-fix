import { matchesAllWords, naturalCompare, normalise } from "./normalise";

export type BoardSummary = {
  id: string;
  gpuMaker: string;
  generation: string;
  gpuModel: string;
  cardBrand: string;
  cardName: string;
  boardCode: string | null;
  revision: string | null;
  aliases: string[];
  fileTypes: string[];
  ticketCount?: number;
  readingCount?: number;
};

export type BoardFilters = {
  q?: string;
  maker?: string;
  generation?: string;
  gpu?: string;
  brand?: string;
  has?: string[];
  /** Boards to include even when only their PDFs matched the search words. */
  alsoMatching?: Set<string>;
};

export const FILE_BADGES = [
  { key: "boardview", types: ["BOARDVIEW", "BOARDVIEW_PDF"] },
  { key: "schematic", types: ["SCHEMATIC"] },
  { key: "bios", types: ["BIOS"] },
  { key: "readings", types: [] },
  { key: "history", types: [] },
] as const;

export type BadgeKey = (typeof FILE_BADGES)[number]["key"];

export function hasBadge(board: BoardSummary, key: string): boolean {
  if (key === "history") return (board.ticketCount ?? 0) > 0;
  if (key === "readings") return (board.readingCount ?? 0) > 0;
  const badge = FILE_BADGES.find((b) => b.key === key);
  return !!badge && board.fileTypes.some((t) => (badge.types as readonly string[]).includes(t));
}

export function boardTitle(board: Pick<BoardSummary, "cardBrand" | "gpuModel" | "cardName">): string {
  return [board.cardBrand, board.gpuModel, board.cardName].filter(Boolean).join(" ");
}

const gpuNumber = (model: string) => Number(model.match(/\d{3,4}/)?.[0] ?? 0);

/**
 * Rough launch year. The number in a name cannot order GPUs by itself:
 * an HD 8570 is far older than an RTX 2080, and a 9800 GTX older than both.
 */
function gpuYear(model: string): number {
  const n = gpuNumber(model);
  if (/^Arc /.test(model)) return 2022;
  if (/^Tesla /.test(model)) return 2020;
  if (/^Quadro /.test(model)) return 2019;
  if (/^P10\d-/.test(model)) return 2017;
  if (/Titan/.test(model)) return 2016;
  if (/Vega/.test(model)) return 2017;
  if (/^RTX /.test(model)) return { 5: 2025, 4: 2022, 3: 2020, 2: 2018 }[Math.floor(n / 1000)] ?? 0;
  if (/^RX /.test(model)) return n >= 1000 ? ({ 9: 2025, 7: 2022, 6: 2020, 5: 2019 }[Math.floor(n / 1000)] ?? 0) : 2016;
  if (/^GTX /.test(model)) {
    if (n >= 1600 && n < 1700) return 2018; // listed with, and below, RTX 2000
    if (n >= 1000 && n < 1600) return 2016;
    if (n >= 900 && n < 1000) return 2014;
    return n >= 600 && n < 900 ? 2012 : 2008;
  }
  if (/^(R9|R7|R5) /.test(model)) return 2014;
  if (/^Radeon /.test(model)) return 2017;
  if (/^HD /.test(model)) return n >= 7000 ? 2012 : 2009;
  return /^GT/.test(model) ? 2010 : 0;
}

/** Newest GPU first, then the highest number, then the natural order of its name. */
export function compareGpus(a: string, b: string): number {
  return gpuYear(b) - gpuYear(a) || gpuNumber(b) - gpuNumber(a) || naturalCompare(a, b);
}

function isExactCode(board: BoardSummary, query: string): boolean {
  if (!board.boardCode) return false;
  const code = normalise(board.boardCode);
  const wanted = normalise(query);
  return !!wanted && (code === wanted || code === `ms${wanted}`);
}

export { isExactCode };

function searchFields(board: BoardSummary): string[] {
  return [
    ...board.aliases,
    board.gpuMaker,
    board.generation,
    board.gpuModel,
    board.cardBrand,
    board.cardName,
    board.boardCode ?? "",
    board.revision ? `rev${board.revision}` : "",
  ].map(normalise);
}

export function filterBoards(boards: BoardSummary[], filters: BoardFilters): BoardSummary[] {
  const q = filters.q?.trim() ?? "";
  const browsing = !q && !filters.maker && !filters.generation && !filters.gpu && !filters.brand;
  const named = (b: BoardSummary) => !q || matchesAllWords(q, searchFields(b));
  return boards
    .filter((b) => {
      if (browsing && b.gpuMaker === "Retro") return false;
      if (filters.maker && b.gpuMaker !== filters.maker) return false;
      if (filters.generation && b.generation !== filters.generation) return false;
      if (filters.gpu && b.gpuModel !== filters.gpu) return false;
      if (filters.brand && b.cardBrand !== filters.brand) return false;
      if (filters.has?.some((key) => !hasBadge(b, key))) return false;
      return named(b) || !!filters.alsoMatching?.has(b.id);
    })
    .sort(
      (a, b) =>
        Number(isExactCode(b, q)) - Number(isExactCode(a, q)) ||
        Number(named(b)) - Number(named(a)) ||
        Number(a.gpuMaker === "Retro") - Number(b.gpuMaker === "Retro") ||
        compareGpus(a.gpuModel, b.gpuModel) ||
        naturalCompare(a.cardBrand, b.cardBrand) ||
        naturalCompare(a.cardName, b.cardName) ||
        naturalCompare(a.boardCode ?? "", b.boardCode ?? "") ||
        naturalCompare(a.revision ?? "", b.revision ?? "")
    );
}

/** Boards for a ticket, with the exact GPU ahead of boards that are only shared with it. */
export function suggestBoards(boards: BoardSummary[], brand: string, model: string, limit = 5): BoardSummary[] {
  const wanted = normalise(`${brand} ${model}`);
  const exactGpu = (b: BoardSummary) => wanted.includes(normalise(b.gpuModel));
  return filterBoards(boards, { q: `${brand} ${model}` })
    .sort((a, b) => Number(exactGpu(b)) - Number(exactGpu(a)))
    .slice(0, limit);
}

function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

/** Used when nothing matches, so a typing slip never ends in an empty page. */
export function closeMatches(boards: BoardSummary[], query: string, limit = 5): string[] {
  const wanted = normalise(query);
  if (!wanted) return [];
  const names = new Set<string>();
  for (const b of boards) {
    if (b.gpuModel !== "Unidentified") names.add(b.gpuModel);
    if (b.boardCode) names.add(b.boardCode);
  }
  return [...names]
    .map((name) => ({ name, distance: editDistance(wanted, normalise(name)) }))
    .sort((a, b) => a.distance - b.distance || naturalCompare(a.name, b.name))
    .slice(0, limit)
    .map((m) => m.name);
}

export type TreeNode = { label: string; count: number; children: TreeNode[] };

const MAKER_ORDER = ["NVIDIA", "AMD", "Intel", "Retro"];

function group(boards: BoardSummary[], key: (b: BoardSummary) => string, order: (a: string, b: string) => number) {
  const map = new Map<string, BoardSummary[]>();
  for (const b of boards) map.set(key(b), [...(map.get(key(b)) ?? []), b]);
  return [...map].sort(([a], [b]) => order(a, b));
}

const byMaker = (a: string, b: string) => MAKER_ORDER.indexOf(a) - MAKER_ORDER.indexOf(b);

function firstGpu(boards: BoardSummary[], generation: string) {
  return boards.find((b) => b.generation === generation)?.gpuModel ?? "";
}

/** Maker, generation, GPU, brand. Folders are only a view of these fields. */
export function gpuTree(boards: BoardSummary[]): TreeNode[] {
  return group(boards, (b) => b.gpuMaker, byMaker).map(([maker, inMaker]) => ({
    label: maker,
    count: inMaker.length,
    children: group(inMaker, (b) => b.generation, (a, b) => compareGpus(firstGpu(inMaker, a), firstGpu(inMaker, b))).map(
      ([generation, inGeneration]) => ({
        label: generation,
        count: inGeneration.length,
        children: group(inGeneration, (b) => b.gpuModel, compareGpus).map(([gpu, inGpu]) => ({
          label: gpu,
          count: inGpu.length,
          children: group(inGpu, (b) => b.cardBrand, naturalCompare).map(([brand, inBrand]) => ({
            label: brand,
            count: inBrand.length,
            children: [],
          })),
        })),
      })
    ),
  }));
}

/** Brand, then GPU, using the same records and moving no files. */
export function brandTree(boards: BoardSummary[]): TreeNode[] {
  return group(boards, (b) => b.cardBrand, naturalCompare).map(([brand, inBrand]) => ({
    label: brand,
    count: inBrand.length,
    children: group(inBrand, (b) => b.gpuModel, compareGpus).map(([gpu, inGpu]) => ({
      label: gpu,
      count: inGpu.length,
      children: [],
    })),
  }));
}
