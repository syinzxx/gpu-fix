import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { classify, resolveAcrossFiles, type Classification } from "./classify";
import { normalise } from "./normalise";

export type ScanRoot = { label: string; path: string };

export type ScanSummary = {
  seen: number;
  hashed: number;
  newFiles: number;
  missing: number;
  boards: number;
  inbox: number;
  duplicates: number;
  ignored: number;
};

type Found = {
  rootId: string;
  rootPriority: number;
  relativePath: string;
  size: number;
  mtimeMs: number;
  sha256: string | null;
  fileId: string | null;
  locked: boolean;
  c: Classification;
};

const BATCH = 200;

async function walk(dir: string, onFile: (fullPath: string) => Promise<void>) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, onFile);
    else if (entry.isFile()) await onFile(full);
  }
}

function hashFile(fullPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(fullPath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

/** Writes in small transactions so a long scan never holds the database for long. */
async function inBatches<T>(db: PrismaClient, items: T[], write: (item: T, tx: Tx) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += BATCH) {
    await db.$transaction(async (tx) => {
      for (const item of items.slice(i, i + BATCH)) await write(item, tx);
    });
  }
}
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const looksLikeExtraCopy = (relativePath: string) => /extra copies|\(copy \d+\)|\(\d+\)\.[^.]+$/i.test(relativePath);

/** The copy that stays visible: the first folder scanned, not an extra copy, then the shortest path. */
function pickPrimary(group: Found[]): Found {
  return [...group].sort(
    (a, b) =>
      a.rootPriority - b.rootPriority ||
      Number(looksLikeExtraCopy(a.relativePath)) - Number(looksLikeExtraCopy(b.relativePath)) ||
      a.relativePath.length - b.relativePath.length ||
      a.relativePath.localeCompare(b.relativePath)
  )[0];
}

/**
 * Reads each root and brings the library up to date. Put the best-organized
 * root first, because its copy is the one shown. Safe to run again: only
 * changed files are hashed, boards marked manuallyEdited keep their fields,
 * and files marked lockedByUser stay on the board the user chose.
 */
export async function scanLibrary(
  db: PrismaClient,
  roots: ScanRoot[],
  onProgress: (message: string) => void = () => {}
): Promise<ScanSummary> {
  const summary: ScanSummary = { seen: 0, hashed: 0, newFiles: 0, missing: 0, boards: 0, inbox: 0, duplicates: 0, ignored: 0 };
  const found: Found[] = [];
  const seenIds = new Set<string>();
  const scannedRootIds: string[] = [];

  for (const [priority, root] of roots.entries()) {
    const row = await db.libraryRoot.upsert({
      where: { path: root.path },
      update: { priority },
      create: { label: root.label, path: root.path, priority },
    });
    scannedRootIds.push(row.id);
    const known = new Map(
      (await db.boardFile.findMany({ where: { libraryRootId: row.id } })).map((f) => [f.relativePath, f])
    );

    await walk(root.path, async (fullPath) => {
      const relativePath = path.relative(root.path, fullPath);
      const info = await stat(fullPath);
      const mtimeMs = Math.floor(info.mtimeMs); // whole milliseconds survive saving, fractions do not
      const c = classify(relativePath, info.size);
      const existing = known.get(relativePath);
      if (existing) seenIds.add(existing.id);
      else if (c.fileType !== "IGNORED") summary.newFiles++;

      let sha256: string | null = null;
      if (c.fileType !== "IGNORED" && info.size > 0) {
        const unchanged = existing?.sha256 && existing.size === info.size && existing.mtimeMs === mtimeMs;
        if (unchanged) {
          sha256 = existing.sha256;
        } else {
          sha256 = await hashFile(fullPath);
          summary.hashed++;
          if (summary.hashed % 250 === 0) onProgress(`Read ${summary.hashed} files`);
        }
      }
      summary.seen++;
      found.push({
        rootId: row.id,
        rootPriority: priority,
        relativePath,
        size: info.size,
        mtimeMs,
        sha256,
        fileId: existing?.id ?? null,
        locked: existing?.lockedByUser ?? false,
        c,
      });
    });
  }

  onProgress(`Sorting ${found.length} files`);
  const resolved = resolveAcrossFiles(found);

  // An exact copy of an identified file is that same board, whatever it is called.
  const usable = resolved.filter((f) => f.c.fileType !== "IGNORED");
  summary.ignored = resolved.length - usable.length;
  const byHash = new Map<string, Found[]>();
  for (const f of usable) {
    if (!f.sha256) continue;
    byHash.set(f.sha256, [...(byHash.get(f.sha256) ?? []), f]);
  }
  const primaryOf = new Map<Found, Found>();
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    const primary = pickPrimary(group);
    const identified = group.filter((f) => !f.c.reviewReason && f.c.identityKey);
    const known = identified.length ? pickPrimary(identified).c : null;
    for (const f of group) {
      if (f !== primary) primaryOf.set(f, primary);
      if (known && f.c.reviewReason) f.c = { ...f.c, ...pick(known), reviewReason: null };
    }
  }

  // Boards
  const groups = new Map<string, Found[]>();
  for (const f of usable) {
    if (f.c.reviewReason || !f.c.identityKey) continue;
    groups.set(f.c.identityKey, [...(groups.get(f.c.identityKey) ?? []), f]);
  }
  const boardIds = new Map<string, string>();
  const existingBoards = new Map(
    (await db.board.findMany({ select: { id: true, identityKey: true, manuallyEdited: true } })).map((b) => [b.identityKey, b])
  );
  await inBatches(db, [...groups], async ([identityKey, files], tx) => {
    const { c } = [...files].sort((a, b) => Number(b.c.modelSource === "name") - Number(a.c.modelSource === "name"))[0];
    const cardName = files.map((f) => f.c.cardName).find(Boolean) ?? "";
    const fields = {
      gpuMaker: c.gpuMaker,
      generation: c.generation,
      gpuModel: c.gpuModel,
      cardBrand: c.cardBrand,
      cardName,
      boardCode: c.boardCode,
      revision: c.revision,
    };
    const existing = existingBoards.get(identityKey);
    const board = existing
      ? existing.manuallyEdited
        ? existing
        : await tx.board.update({ where: { id: existing.id }, data: fields })
      : await tx.board.create({ data: { identityKey, ...fields } });
    boardIds.set(identityKey, board.id);

    const known = new Set(
      (await tx.boardAlias.findMany({ where: { boardId: board.id }, select: { normalised: true } })).map((a) => a.normalised)
    );
    const names = files.flatMap((f) => [...f.c.aliases, path.basename(f.relativePath)]);
    for (const alias of names) {
      const normalised = normalise(alias);
      if (!normalised || known.has(normalised)) continue;
      known.add(normalised);
      await tx.boardAlias.create({ data: { boardId: board.id, alias, normalised } });
    }
  });
  summary.boards = groups.size;

  // Files
  const fileIds = new Map<Found, string>();
  await inBatches(db, usable, async (f, tx) => {
    const inInbox = Boolean(f.c.reviewReason);
    const placement = f.locked
      ? {}
      : {
          boardId: f.c.identityKey && !inInbox ? (boardIds.get(f.c.identityKey) ?? null) : null,
          reviewState: inInbox ? "INBOX" : "CONFIRMED",
          reviewReason: f.c.reviewReason,
          suggestion: inInbox ? JSON.stringify(suggestionFrom(f.c)) : null,
        };
    const data = {
      fileType: f.c.fileType,
      sha256: f.sha256,
      size: f.size,
      mtimeMs: f.mtimeMs,
      revision: f.c.revision,
      status: "ACTIVE",
      ...placement,
    };
    const row = f.fileId
      ? await tx.boardFile.update({ where: { id: f.fileId }, data })
      : await tx.boardFile.create({
          data: {
            ...data,
            libraryRootId: f.rootId,
            relativePath: f.relativePath,
            originalName: path.basename(f.relativePath),
          },
        });
    fileIds.set(f, row.id);
    seenIds.add(row.id);
  });

  await inBatches(db, usable, async (f, tx) => {
    const primary = primaryOf.get(f);
    await tx.boardFile.update({
      where: { id: fileIds.get(f) },
      data: { duplicateOfId: primary ? fileIds.get(primary) : null },
    });
  });
  summary.duplicates = primaryOf.size;

  // Files that have gone stay listed as missing, so links and history survive a moved drive.
  const active = await db.boardFile.findMany({
    where: { libraryRootId: { in: scannedRootIds }, status: "ACTIVE" },
    select: { id: true },
  });
  const missing = active.filter((f) => !seenIds.has(f.id)).map((f) => f.id);
  for (let i = 0; i < missing.length; i += BATCH) {
    await db.boardFile.updateMany({ where: { id: { in: missing.slice(i, i + BATCH) } }, data: { status: "MISSING" } });
  }
  summary.missing = missing.length;

  // A rule change can give a board a new identity. Drop the empty board it leaves behind.
  await db.board.deleteMany({ where: { manuallyEdited: false, files: { none: {} } } });

  summary.inbox = await db.boardFile.count({ where: { reviewState: "INBOX", status: "ACTIVE", duplicateOfId: null } });
  return summary;
}

function pick(c: Classification) {
  const { gpuMaker, generation, gpuModel, otherModels, cardBrand, cardName, boardCode, revision, aliases, identityKey } = c;
  return { gpuMaker, generation, gpuModel, otherModels, cardBrand, cardName, boardCode, revision, aliases, identityKey };
}

function suggestionFrom(c: Classification) {
  return { gpuMaker: c.gpuMaker, gpuModel: c.gpuModel, cardBrand: c.cardBrand, boardCode: c.boardCode, revision: c.revision };
}
