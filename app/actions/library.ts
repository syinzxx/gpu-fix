"use server";

import { existsSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireLibraryAccess } from "@/lib/library/access";
import { aliasesForModels, describeModel } from "@/lib/library/classify";
import { CONDITIONS, MODES, POLARITIES, parseReading } from "@/lib/library/measurements";
import { normalise } from "@/lib/library/normalise";
import { indexingRunning, nexusRunning, startPdfIndexing } from "@/lib/library/index-runner";
import { pdfsWaitingForText } from "@/lib/library/queries";
import { scanLibrary, type ScanSummary } from "@/lib/library/scan";

async function requireEditor() {
  await requireLibraryAccess();
  return requireRole("ADMIN", "TECHNICIAN");
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const optional = (form: FormData, key: string) => text(form, key) || null;

function boardFields(form: FormData) {
  const gpuModel = text(form, "gpuModel");
  const cardBrand = text(form, "cardBrand");
  if (!gpuModel || !cardBrand) throw new Error("Brand and GPU are required.");
  return {
    ...describeModel(gpuModel),
    gpuModel,
    cardBrand,
    cardName: text(form, "cardName"),
    boardCode: optional(form, "boardCode"),
    revision: optional(form, "revision"),
    memoryType: optional(form, "memoryType"),
    memorySize: optional(form, "memorySize"),
    notes: optional(form, "notes"),
    manuallyEdited: true,
  };
}

function aliasRows(boardId: string, names: string[]) {
  const seen = new Set<string>();
  return names.flatMap((alias) => {
    const normalised = normalise(alias);
    if (!normalised || seen.has(normalised)) return [];
    seen.add(normalised);
    return [{ boardId, alias, normalised }];
  });
}

async function addAliases(boardId: string, names: string[]) {
  for (const row of aliasRows(boardId, names)) {
    await db.boardAlias.upsert({
      where: { boardId_normalised: { boardId, normalised: row.normalised } },
      update: {},
      create: row,
    });
  }
}

function refresh(boardId?: string) {
  revalidatePath("/dashboard/library");
  revalidatePath("/dashboard/library/inbox");
  if (boardId) revalidatePath(`/dashboard/library/${boardId}`);
}

export async function updateBoard(boardId: string, form: FormData) {
  await requireEditor();
  const fields = boardFields(form);
  await db.board.update({ where: { id: boardId }, data: fields });
  await addAliases(boardId, aliasesForModels([fields.gpuModel], fields.boardCode, fields.cardBrand));
  refresh(boardId);
}

export async function addBoardAlias(boardId: string, form: FormData) {
  await requireEditor();
  await addAliases(boardId, [text(form, "alias")]);
  refresh(boardId);
}

export async function removeBoardAlias(aliasId: string, boardId: string) {
  await requireEditor();
  await db.boardAlias.delete({ where: { id: aliasId } });
  refresh(boardId);
}

/** A file and its exact copies move together and stay put through rescans. */
async function placeFile(fileId: string, boardId: string) {
  await db.boardFile.updateMany({
    where: { OR: [{ id: fileId }, { duplicateOfId: fileId }] },
    data: { boardId, lockedByUser: true, reviewState: "CONFIRMED", reviewReason: null, suggestion: null },
  });
}

// The picker's text ends with the board id, because a datalist can only return what it shows.
const boardIdFromPicker = (value: string) => value.match(/#([a-z0-9]+)$/i)?.[1] ?? "";

export async function moveFileToBoard(fileId: string, form: FormData) {
  await requireEditor();
  const board = await db.board.findUnique({ where: { id: boardIdFromPicker(text(form, "board")) } });
  if (!board) throw new Error("Choose a board from the list.");
  await placeFile(fileId, board.id);
  refresh(board.id);
}

export async function createBoardFromFile(fileId: string, form: FormData) {
  await requireEditor();
  const fields = boardFields(form);
  const file = await db.boardFile.findUniqueOrThrow({ where: { id: fileId } });
  const board = await db.board.create({ data: { identityKey: `manual|${fileId}|${Date.now()}`, ...fields } });
  await addAliases(board.id, [
    ...aliasesForModels([fields.gpuModel], fields.boardCode, fields.cardBrand),
    file.originalName,
  ]);
  await placeFile(fileId, board.id);
  refresh(board.id);
  redirect(`/dashboard/library/${board.id}`);
}

/** The board goes, the files do not. They wait in the Inbox and stay out of rescans. */
export async function deleteBoard(boardId: string) {
  await requireEditor();
  const board = await db.board.findUniqueOrThrow({ where: { id: boardId } });
  await db.$transaction([
    db.boardFile.updateMany({
      where: { boardId },
      data: {
        boardId: null,
        lockedByUser: true,
        reviewState: "INBOX",
        reviewReason: "Returned from a deleted board.",
        suggestion: JSON.stringify({
          gpuModel: board.gpuModel,
          cardBrand: board.cardBrand,
          boardCode: board.boardCode,
          revision: board.revision,
        }),
      },
    }),
    db.board.delete({ where: { id: boardId } }),
  ]);
  refresh();
  redirect("/dashboard/library");
}

/** Everything from this board moves to the chosen one, including its names. */
export async function mergeBoardInto(boardId: string, form: FormData) {
  await requireEditor();
  const targetId = boardIdFromPicker(text(form, "board"));
  if (targetId === boardId) throw new Error("Choose a different board.");
  const target = await db.board.findUniqueOrThrow({ where: { id: targetId } });
  const aliases = await db.boardAlias.findMany({ where: { boardId } });
  await db.boardFile.updateMany({
    where: { boardId },
    data: { boardId: target.id, lockedByUser: true, reviewState: "CONFIRMED", reviewReason: null, suggestion: null },
  });
  await addAliases(target.id, aliases.map((a) => a.alias));
  await db.ticket.updateMany({ where: { boardId }, data: { boardId: target.id } });
  await db.measurement.updateMany({ where: { boardId }, data: { boardId: target.id } });
  await db.boardNote.updateMany({ where: { boardId }, data: { boardId: target.id } });
  await db.board.update({ where: { id: target.id }, data: { manuallyEdited: true } });
  await db.board.delete({ where: { id: boardId } });
  refresh(target.id);
  redirect(`/dashboard/library/${target.id}`);
}

/** Any staff member logging a repair can link its board. */
export async function linkTicketToBoard(ticketId: string, form: FormData) {
  await requireLibraryAccess();
  await requireUser();
  const board = await db.board.findUnique({ where: { id: boardIdFromPicker(text(form, "board")) } });
  if (!board) throw new Error("Choose a board from the list.");
  await db.ticket.update({ where: { id: ticketId }, data: { boardId: board.id } });
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  refresh(board.id);
}

export async function unlinkTicketBoard(ticketId: string) {
  await requireLibraryAccess();
  await requireUser();
  const { boardId } = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  await db.ticket.update({ where: { id: ticketId }, data: { boardId: null } });
  revalidatePath(`/dashboard/tickets/${ticketId}`);
  refresh(boardId ?? undefined);
}

export type MeasurementState = { ok?: boolean; error?: "target" | "value" };

export async function addMeasurement(boardId: string, _previous: MeasurementState, form: FormData): Promise<MeasurementState> {
  await requireLibraryAccess();
  const user = await requireRole("ADMIN", "TECHNICIAN");
  const target = text(form, "target");
  const mode = text(form, "mode");
  const condition = text(form, "condition");
  const polarity = mode === "DIODE" ? text(form, "polarity") : "NOT_APPLICABLE";
  const isOpen = form.get("open") === "on";
  const value = isOpen ? null : parseReading(text(form, "value"), text(form, "unit"));

  const known = (list: readonly string[], item: string) => list.includes(item);
  if (!target) return { error: "target" };
  if (!known(MODES, mode) || !known(CONDITIONS, condition) || !known(POLARITIES, polarity)) return { error: "value" };
  if (!isOpen && value === null) return { error: "value" };

  await db.measurement.create({
    data: {
      boardId,
      target,
      mode,
      polarity,
      condition,
      value,
      meter: optional(form, "meter"),
      note: optional(form, "note"),
      createdById: user.id,
    },
  });
  refresh(boardId);
  return { ok: true };
}

export async function deleteMeasurement(id: string, boardId: string) {
  await requireEditor();
  await db.measurement.delete({ where: { id } });
  refresh(boardId);
}

export async function addBoardNote(boardId: string, form: FormData) {
  await requireLibraryAccess();
  const user = await requireRole("ADMIN", "TECHNICIAN");
  const kind = text(form, "kind");
  const title = text(form, "title");
  if (!["FAULT", "POWER_ON", "RAIL"].includes(kind) || !title) throw new Error("Choose a type and enter a heading.");
  const board = await db.board.findUniqueOrThrow({ where: { id: boardId } });
  const forFamily = text(form, "scope") === "FAMILY";
  await db.boardNote.create({
    data: {
      boardId: forFamily ? null : boardId,
      generation: forFamily ? board.generation : null,
      kind,
      title,
      body: optional(form, "body"),
      createdById: user.id,
    },
  });
  refresh(boardId);
}

export async function deleteBoardNote(id: string, boardId: string) {
  await requireEditor();
  await db.boardNote.delete({ where: { id } });
  refresh(boardId);
}

async function requireFolderAdmin() {
  await requireLibraryAccess();
  return requireRole("ADMIN");
}

export async function addLibraryFolder(form: FormData) {
  await requireFolderAdmin();
  const folder = text(form, "path");
  if (!path.win32.isAbsolute(folder) || !existsSync(folder)) throw new Error("That folder could not be found.");
  const last = await db.libraryRoot.findFirst({ orderBy: { priority: "desc" } });
  await db.libraryRoot.create({
    data: { label: path.win32.basename(folder), path: folder, priority: (last?.priority ?? -1) + 1 },
  });
  revalidatePath("/dashboard/library/folders");
}

/** Removes the records only, never the files on disk. */
export async function removeLibraryFolder(rootId: string) {
  await requireFolderAdmin();
  await db.boardFile.updateMany({ where: { libraryRootId: rootId }, data: { duplicateOfId: null } });
  await db.boardFile.updateMany({ where: { duplicateOf: { libraryRootId: rootId } }, data: { duplicateOfId: null } });
  await db.libraryRoot.delete({ where: { id: rootId } });
  await db.board.deleteMany({
    where: {
      manuallyEdited: false,
      files: { none: {} },
      tickets: { none: {} },
      measurements: { none: {} },
      notesList: { none: {} },
    },
  });
  refresh();
  revalidatePath("/dashboard/library/folders");
}

export type PdfReading = "started" | "running" | "nexus-closed" | "none";
export type RescanState = { summary?: ScanSummary; error?: boolean; pdfsWaiting?: number; pdfReading?: PdfReading };

/** New PDFs become searchable only once NexusBV has read them. */
async function readNewPdfs(): Promise<{ pdfsWaiting: number; pdfReading: PdfReading }> {
  const pdfsWaiting = await pdfsWaitingForText();
  if (!pdfsWaiting) return { pdfsWaiting, pdfReading: "none" };
  if (indexingRunning()) return { pdfsWaiting, pdfReading: "running" };
  if (!nexusRunning()) return { pdfsWaiting, pdfReading: "nexus-closed" };
  startPdfIndexing();
  return { pdfsWaiting, pdfReading: "started" };
}

export async function rescanLibrary(): Promise<RescanState> {
  await requireFolderAdmin();
  const roots = await db.libraryRoot.findMany({ orderBy: { priority: "asc" }, select: { label: true, path: true } });
  try {
    const summary = await scanLibrary(db, roots);
    refresh();
    revalidatePath("/dashboard/library/folders");
    return { summary, ...(await readNewPdfs()) };
  } catch {
    return { error: true };
  }
}
