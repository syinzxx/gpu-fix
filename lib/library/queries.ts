import { db } from "@/lib/db";
import type { BoardSummary } from "./search";

/** About 1,600 boards, small enough to search in memory with every alias. */
export async function loadBoardSummaries(): Promise<BoardSummary[]> {
  const boards = await db.board.findMany({
    include: {
      aliases: { select: { alias: true } },
      files: { where: { status: "ACTIVE" }, select: { fileType: true }, distinct: ["fileType"] },
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
  }));
}

export function inboxCount() {
  return db.boardFile.count({ where: { reviewState: "INBOX", status: "ACTIVE", duplicateOfId: null } });
}
