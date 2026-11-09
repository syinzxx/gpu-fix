import path from "node:path";

/**
 * Words found inside schematic PDFs, kept in their own SQLite file. It can be
 * rebuilt from the PDFs at any time, and keeping it apart leaves the shop
 * database small enough to back up easily. Files are keyed by content hash,
 * so every copy of a PDF shares one entry.
 */

type Statement = { run: (...args: unknown[]) => unknown; all: (...args: unknown[]) => Record<string, unknown>[] };
type Database = { exec: (sql: string) => void; prepare: (sql: string) => Statement; close: () => void };
type SqliteModule = { DatabaseSync: new (file: string) => Database };

export const INDEX_PATH = process.env.LIBRARY_SEARCH_DB ?? path.join(process.cwd(), "prisma", "library-search.db");
const MAX_FILES = 3000;

/** OK = PDF text, OCR = read from page images, PARTS = a boardview's parts and nets. */
export type IndexStatus = "OK" | "OCR" | "PARTS" | "SCANNED" | "FAILED";

export function openIndex(file = INDEX_PATH): Database {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as unknown as SqliteModule;
  const db = new DatabaseSync(file);
  // Searches and the indexing job can overlap, so wait for a moment instead of failing.
  db.exec("PRAGMA busy_timeout = 10000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS indexed (sha256 TEXT PRIMARY KEY, status TEXT NOT NULL, pages INTEGER, chars INTEGER, name TEXT);
    CREATE VIRTUAL TABLE IF NOT EXISTS terms USING fts5(
      sha256 UNINDEXED, words, prefix = '3 4', tokenize = "unicode61 tokenchars '_#+-./'"
    );
  `);
  return db;
}

/** Part numbers and net names, without the ordinary words around them. */
export function extractTerms(text: string): string[] {
  const terms = new Set<string>();
  for (const [word] of text.matchAll(/[A-Za-z0-9+#][A-Za-z0-9_+#./-]{2,}/g)) {
    const looksTechnical = /[\d_#]/.test(word) || (word === word.toUpperCase() && word.length >= 4);
    if (looksTechnical) terms.add(word.toUpperCase().replace(/[-./+]+$/, ""));
  }
  return [...terms];
}

/** A PDF of page images has almost no text, so it needs OCR before it can be searched. */
export function looksScanned(pages: number, chars: number): boolean {
  return pages > 0 && chars / pages < 40;
}

/** Every word must appear, and matching the start of a term finds MP2888 in MP2888A. */
export function matchQuery(query: string): string | null {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  return words.map((w) => `"${w.replace(/"/g, "")}"*`).join(" AND ");
}

export function saveFile(db: Database, sha256: string, status: IndexStatus, pages: number, chars: number, name: string, terms: string[]) {
  db.prepare("INSERT OR REPLACE INTO indexed (sha256, status, pages, chars, name) VALUES (?, ?, ?, ?, ?)").run(sha256, status, pages, chars, name);
  db.prepare("DELETE FROM terms WHERE sha256 = ?").run(sha256);
  if (terms.length) db.prepare("INSERT INTO terms (sha256, words) VALUES (?, ?)").run(sha256, terms.join(" "));
}

export function indexedHashes(db: Database): Set<string> {
  return new Set(db.prepare("SELECT sha256 FROM indexed").all().map((row) => String(row.sha256)));
}

export function findHashes(db: Database, query: string): string[] {
  const match = matchQuery(query);
  if (!match) return [];
  return db.prepare(`SELECT sha256 FROM terms WHERE words MATCH ? LIMIT ${MAX_FILES}`).all(match).map((row) => String(row.sha256));
}
