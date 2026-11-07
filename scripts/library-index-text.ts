/**
 * Reads the text of every schematic PDF into the search file.
 *   npm run library:index
 * NexusBV must be open with a board loaded. PDFs are only read. Safe to stop:
 * running it again continues with the files still to do.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { extractTerms, indexedHashes, looksScanned, openIndex, saveFile, INDEX_PATH } from "../lib/library/text-index";

type Page = { text?: string };
type Nexus = { extractText: (pdf: string, output: string) => Promise<{ pages?: Page[] } | null>; getState: () => Promise<unknown>; stop: () => void };

const require = createRequire(import.meta.url);
const { createNexusBV } = require("../desktop/nexusbv.js") as { createNexusBV: (options: { getDir: () => string }) => Nexus };

async function main() {
  const prisma = new PrismaClient();
  const nexus = createNexusBV({ getDir: () => process.env.NEXUSBV_DIR ?? path.join(os.homedir(), "Desktop", "NexusBV 0.9") });
  const index = openIndex();
  const scratch = path.join(os.tmpdir(), `library-index-${process.pid}.json`);
  const started = Date.now();

  try {
    await nexus.getState();
    const done = indexedHashes(index);
    const files = await prisma.boardFile.findMany({
      where: { status: "ACTIVE", duplicateOfId: null, sha256: { not: null }, fileType: { in: ["SCHEMATIC", "BOARDVIEW_PDF"] } },
      include: { libraryRoot: true },
      orderBy: { relativePath: "asc" },
    });
    const todo = files.filter((file) => file.sha256 && !done.has(file.sha256));
    console.log(`${files.length} PDFs, ${todo.length} to read, saving to ${INDEX_PATH}`);

    const tally = { OK: 0, SCANNED: 0, FAILED: 0 };
    for (const [position, file] of todo.entries()) {
      const pdf = path.win32.join(file.libraryRoot.path, file.relativePath);
      const sha256 = file.sha256 as string;
      try {
        const result = await nexus.extractText(pdf, scratch);
        if (!result) throw new Error("no result");
        const pages = result.pages ?? [];
        const text = pages.map((page) => page.text ?? "").join(" ");
        const status = looksScanned(pages.length, text.length) ? "SCANNED" : "OK";
        saveFile(index, sha256, status, pages.length, text.length, file.originalName, status === "OK" ? extractTerms(text) : []);
        tally[status]++;
      } catch (error) {
        if ((error as { code?: string }).code === "NOT_RUNNING") throw error; // stop, and let a later run continue
        saveFile(index, sha256, "FAILED", 0, 0, file.originalName, []);
        tally.FAILED++;
      }
      if ((position + 1) % 100 === 0) console.log(`${position + 1}/${todo.length} ${JSON.stringify(tally)}`);
    }
    console.log(JSON.stringify({ ...tally, minutes: Math.round((Date.now() - started) / 60000) }));
  } finally {
    fs.rmSync(scratch, { force: true });
    nexus.stop();
    index.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.code === "NOT_RUNNING" ? "NexusBV is not answering. Open it with a board loaded, then run this again." : error);
  process.exit(1);
});
