/**
 * Makes the parts and nets inside boardviews searchable, so a chip that is
 * missing from a board's PDF can still find the board.
 *   npm run library:parts            (every board not read yet)
 *   npm run library:parts -- 5       (only the next 5, for a test)
 * NexusBV must be open. This opens each board in turn, so NexusBV cannot be
 * used for anything else while it runs. Safe to stop and run again later.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { LOCK_PATH, indexingRunning } from "../lib/library/index-runner";
import { compareGpus } from "../lib/library/search";
import { extractTerms, indexedHashes, openIndex, saveFile } from "../lib/library/text-index";

type Part = { refdes: string; info: string; nets: string[] };
type Nexus = {
  open: (files: { board: string }) => Promise<unknown>;
  listComponents: (offset: number, limit?: number) => Promise<{ parts: Part[]; more: boolean }>;
  stop: () => void;
};
const require = createRequire(import.meta.url);
const { createNexusBV } = require("../desktop/nexusbv.js") as { createNexusBV: (o: { getDir: () => string }) => Nexus };

const PAGE = 40;
const MAX_PAGES = 400; // about 16,000 parts, well past the largest board seen

async function main() {
  if (indexingRunning()) return console.log("Another reading job is running.");
  fs.writeFileSync(LOCK_PATH, String(process.pid));
  const prisma = new PrismaClient();
  const nexus = createNexusBV({ getDir: () => process.env.NEXUSBV_DIR ?? path.join(os.homedir(), "Desktop", "NexusBV 0.9") });
  const index = openIndex();
  const started = Date.now();
  try {
    const done = indexedHashes(index);
    const files = await prisma.boardFile.findMany({
      where: { status: "ACTIVE", duplicateOfId: null, fileType: "BOARDVIEW", sha256: { not: null }, size: { gt: 0 }, board: { gpuMaker: { not: "Retro" } } },
      include: { libraryRoot: true, board: { select: { gpuModel: true } } },
    });
    const todo = files
      .filter((f) => !done.has(f.sha256 as string))
      .sort((a, b) => compareGpus(a.board?.gpuModel ?? "", b.board?.gpuModel ?? ""));
    const limit = Number(process.argv[2] ?? todo.length);
    console.log(`${files.length} boardviews, ${todo.length} to read, reading ${Math.min(limit, todo.length)} newest first`);

    for (const [position, file] of todo.slice(0, limit).entries()) {
      const board = path.win32.join(file.libraryRoot.path, file.relativePath);
      try {
        await nexus.open({ board });
        const words: string[] = [];
        let count = 0;
        for (let page = 0; page < MAX_PAGES; page++) {
          const { parts, more } = await nexus.listComponents(page * PAGE, PAGE);
          count += parts.length;
          for (const part of parts) words.push(part.info, ...part.nets);
          if (!more) break;
        }
        const terms = extractTerms(words.join(" "));
        saveFile(index, file.sha256 as string, "PARTS", count, words.length, file.originalName, terms);
        console.log(`${position + 1}. ${file.board?.gpuModel} ${file.originalName.slice(0, 50)}: ${count} parts, ${terms.length} terms`);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "NOT_RUNNING" || code === "NOT_INSTALLED") throw error;
        saveFile(index, file.sha256 as string, "FAILED", 0, 0, file.originalName, []);
        console.log(`${position + 1}. could not read ${file.originalName.slice(0, 50)} (${code ?? "error"})`);
      }
    }
    console.log(`Done in ${Math.round((Date.now() - started) / 60000)} minutes.`);
  } finally {
    fs.rmSync(LOCK_PATH, { force: true });
    nexus.stop();
    index.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.code === "NOT_RUNNING" ? "NexusBV is not answering. Open it, then run this again." : error);
  fs.rmSync(LOCK_PATH, { force: true });
  process.exit(1);
});
