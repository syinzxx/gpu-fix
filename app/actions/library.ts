"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireLibraryAccess } from "@/lib/library/access";
import { aliasesForModels, describeModel } from "@/lib/library/classify";
import { normalise } from "@/lib/library/normalise";

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
  const board = await db.board.create({ data: { identityKey: `manual|${fileId}`, ...fields } });
  await addAliases(board.id, [
    ...aliasesForModels([fields.gpuModel], fields.boardCode, fields.cardBrand),
    file.originalName,
  ]);
  await placeFile(fileId, board.id);
  refresh(board.id);
  redirect(`/dashboard/library/${board.id}`);
}
