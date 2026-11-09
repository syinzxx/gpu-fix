/**
 * Makes picture-only PDFs searchable: NexusBV renders each page and the OCR
 * built into Windows reads it.
 *   npm run library:ocr
 * NexusBV must be open with a board loaded. PDFs are only read.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { LOCK_PATH, indexingRunning } from "../lib/library/index-runner";
import { extractTerms, openIndex, saveFile } from "../lib/library/text-index";

type Nexus = { renderPage: (pdf: string, page: number) => Promise<{ data: string; mimeType: string }>; getState: () => Promise<unknown>; stop: () => void };
const require = createRequire(import.meta.url);
const { createNexusBV } = require("../desktop/nexusbv.js") as { createNexusBV: (o: { getDir: () => string }) => Nexus };

const OCR_SCRIPT = path.join(__dirname, "windows-ocr.ps1");
const MAX_PAGES = Number(process.env.OCR_MAX_PAGES ?? 60);

function readImages(files: string[]): string {
  return execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", OCR_SCRIPT, "-Lang", "en-US", ...files], {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  }).toString("utf8");
}

async function main() {
  if (indexingRunning()) return console.log("Another reading job is running.");
  fs.writeFileSync(LOCK_PATH, String(process.pid));
  const prisma = new PrismaClient();
  const nexus = createNexusBV({ getDir: () => process.env.NEXUSBV_DIR ?? path.join(os.homedir(), "Desktop", "NexusBV 0.9") });
  const index = openIndex();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "library-ocr-"));
  try {
    await nexus.getState();
    const scanned = index.prepare("SELECT sha256, pages, name FROM indexed WHERE status = 'SCANNED'").all();
    const limit = Number(process.argv[2] ?? scanned.length);
    console.log(`${scanned.length} picture-only PDFs, reading ${Math.min(limit, scanned.length)}`);
    for (const row of scanned.slice(0, limit)) {
      const sha256 = String(row.sha256);
      const file = await prisma.boardFile.findFirst({ where: { sha256, duplicateOfId: null }, include: { libraryRoot: true } });
      if (!file) continue;
      const pdf = path.win32.join(file.libraryRoot.path, file.relativePath);
      const pages = Math.min(Number(row.pages) || 1, MAX_PAGES);
      const images: string[] = [];
      for (let page = 1; page <= pages; page++) {
        try {
          const image = await nexus.renderPage(pdf, page);
          const target = path.join(work, `p${page}.${image.mimeType.includes("jpeg") ? "jpg" : "png"}`);
          fs.writeFileSync(target, Buffer.from(image.data, "base64"));
          images.push(target);
        } catch (error) {
          if ((error as { code?: string }).code === "NOT_RUNNING") throw error;
        }
      }
      const text = images.length ? readImages(images).replace(/^===== .*$/gm, " ") : "";
      const terms = extractTerms(text);
      // Keep it marked as scanned when OCR found nothing, so it stays on the list for a person.
      saveFile(index, sha256, terms.length ? "OCR" : "SCANNED", pages, text.length, String(row.name), terms);
      console.log(`${String(row.name).slice(0, 60)}: ${pages} pages, ${terms.length} terms`);
      for (const image of images) fs.rmSync(image, { force: true });
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(LOCK_PATH, { force: true });
    nexus.stop();
    index.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.code === "NOT_RUNNING" ? "NexusBV is not answering. Open it with a board loaded, then run this again." : error);
  fs.rmSync(LOCK_PATH, { force: true });
  process.exit(1);
});
