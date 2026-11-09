import fs from "node:fs";
import path from "node:path";

/**
 * Copies of the shop database. SQLite's VACUUM INTO makes a clean copy even
 * while the app is running, and each copy is checked before it is kept.
 * The first folder is the main one, the rest are mirrors (another drive).
 */

type Database = { exec: (sql: string) => void; prepare: (sql: string) => { get: () => Record<string, unknown> | undefined }; close: () => void };
type SqliteModule = { DatabaseSync: new (file: string, options?: { readOnly?: boolean }) => Database };

const NAME = /^shop-(\d{4}-\d{2}-\d{2}-\d{4})\.db$/;

export type BackupOptions = { source: string; dirs: string[]; keep: number; now?: Date; uploads?: string };
export type CopyResult = { dir: string; ok: boolean; error?: string };
export type BackupResult = { name: string; bytes: number; copies: CopyResult[] };
export type BackupFile = { dir: string; name: string; bytes: number; at: Date };

function sqlite(): SqliteModule {
  return process.getBuiltinModule("node:sqlite") as unknown as SqliteModule;
}

/** Prisma reads `file:./dev.db` relative to the schema folder. */
export function databaseFile(url = process.env.DATABASE_URL ?? "file:./dev.db", cwd = process.cwd()): string {
  const file = url.replace(/^file:/, "").replace(/\?.*$/, "");
  return path.isAbsolute(file) ? file : path.resolve(cwd, "prisma", file);
}

export function defaultOptions(): BackupOptions {
  const dirs = (process.env.BACKUP_DIRS ?? [path.join(process.cwd(), "backups"), "D:\\GPU Fix Backups"].join(";"))
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);
  return {
    source: databaseFile(),
    dirs,
    keep: Number(process.env.BACKUP_KEEP ?? 30),
    uploads: path.join(process.cwd(), "public", "uploads"),
  };
}

export function backupName(now: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `shop-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}.db`;
}

function checkCopy(file: string) {
  const db = new (sqlite().DatabaseSync)(file, { readOnly: true });
  try {
    const row = db.prepare("PRAGMA integrity_check").get();
    if (Object.values(row ?? {})[0] !== "ok") throw new Error("The copy failed its integrity check.");
  } finally {
    db.close();
  }
}

/** Photos only grow, so only new files are copied. */
function copyNewFiles(from: string, to: string) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyNewFiles(source, target);
    else if (!fs.existsSync(target)) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
}

export function listBackups(dirs: string[]): BackupFile[] {
  return dirs.flatMap((dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((name) => NAME.test(name))
      .map((name) => {
        const stat = fs.statSync(path.join(dir, name));
        return { dir, name, bytes: stat.size, at: stat.mtime };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
  });
}

function prune(dir: string, keep: number) {
  for (const old of listBackups([dir]).slice(keep)) fs.rmSync(path.join(dir, old.name), { force: true });
}

export function backupNow(options: BackupOptions = defaultOptions()): BackupResult {
  const [main, ...mirrors] = options.dirs;
  if (!main) throw new Error("No backup folder is set.");
  if (!fs.existsSync(options.source)) throw new Error(`The database was not found at ${options.source}.`);

  const name = backupName(options.now ?? new Date());
  fs.mkdirSync(main, { recursive: true });
  const target = path.join(main, name);
  const partial = `${target}.partial`;
  fs.rmSync(partial, { force: true });

  const source = new (sqlite().DatabaseSync)(options.source);
  try {
    source.exec(`VACUUM INTO '${partial.replace(/'/g, "''")}'`);
  } finally {
    source.close();
  }
  checkCopy(partial);
  fs.renameSync(partial, target);
  if (options.uploads) copyNewFiles(options.uploads, path.join(main, "uploads"));
  prune(main, options.keep);

  const copies: CopyResult[] = [{ dir: main, ok: true }];
  for (const dir of mirrors) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(target, path.join(dir, name));
      if (options.uploads) copyNewFiles(options.uploads, path.join(dir, "uploads"));
      prune(dir, options.keep);
      copies.push({ dir, ok: true });
    } catch (error) {
      // A missing drive must not stop the main copy, but it has to be visible.
      copies.push({ dir, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { name, bytes: fs.statSync(target).size, copies };
}

/** True when the newest main copy is older than the given hours, or there is none. */
export function isDue(dirs: string[], hours: number, now = new Date()): boolean {
  const newest = listBackups(dirs.slice(0, 1))[0];
  return !newest || now.getTime() - newest.at.getTime() > hours * 3600_000;
}
