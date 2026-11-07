import fs from "node:fs";
import { db } from "@/lib/db";
import { INDEX_PATH, findHashes, openIndex } from "./text-index";
import type { BoardSummary } from "./search";

/** About 1,600 boards, small enough to search in memory with every alias. */
export async function loadBoardSummaries(): Promise<BoardSummary[]> {
  const boards = await db.board.findMany({
    include: {
      aliases: { select: { alias: true } },
      files: { where: { status: "ACTIVE" }, select: { fileType: true }, distinct: ["fileType"] },
      _count: { select: { tickets: true, measurements: true } },
    },
  });
  return boards.map((b) => ({
    id: b.id,
    gpuMaker: b.gpuMaker,
    generation: b.generation,
    gpuModel: b.gpuModel,
    cardBrand: b.cardBrand,
    cardName: b.cardName,
    boardCode: b.boardCode,
    revision: b.revision,
    aliases: b.aliases.map((a) => a.alias),
    fileTypes: b.files.map((f) => f.fileType),
    ticketCount: b._count.tickets,
    readingCount: b._count.measurements,
  }));
}

const HASHES_PER_QUERY = 500;

/** Boards whose PDFs mention the search words. Empty until the index has been built. */
export async function boardsMentioning(query: string): Promise<Set<string>> {
  if (!fs.existsSync(INDEX_PATH)) return new Set();
  const index = openIndex();
  try {
    const hashes = findHashes(index, query);
    const boards = new Set<string>();
    // A term like NVVDD is in nearly every PDF, which is too many values for one query.
    for (let i = 0; i < hashes.length; i += HASHES_PER_QUERY) {
      const files = await db.boardFile.findMany({
        where: { sha256: { in: hashes.slice(i, i + HASHES_PER_QUERY) }, boardId: { not: null } },
        select: { boardId: true },
        distinct: ["boardId"],
      });
      for (const file of files) boards.add(file.boardId as string);
    }
    return boards;
  } finally {
    index.close();
  }
}

export function inboxCount() {
  return db.boardFile.count({ where: { reviewState: "INBOX", status: "ACTIVE", duplicateOfId: null } });
}
