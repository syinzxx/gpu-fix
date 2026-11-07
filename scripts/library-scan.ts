/**
 * Scans board file folders into the library.
 *   npm run library:scan -- "D:\Some Folder" "E:\Another Folder"
 * Files are only read, never changed. With no folders, it rescans the saved ones.
 * List the best-organized folder first: when a file exists twice, that copy is shown.
 */
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { scanLibrary } from "../lib/library/scan";

async function main() {
  const db = new PrismaClient();
  try {
    const given = process.argv.slice(2).map((p) => ({ label: path.basename(p), path: p }));
    const roots = given.length ? given : await db.libraryRoot.findMany({ select: { label: true, path: true }, orderBy: { priority: "asc" } });
    if (!roots.length) throw new Error("No folders to scan. Pass at least one folder.");
    const started = Date.now();
    const summary = await scanLibrary(db, roots, (message) => console.log(message));
    console.log(JSON.stringify({ ...summary, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
