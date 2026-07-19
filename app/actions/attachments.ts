"use server";

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ATTACHMENT_KINDS = ["INTAKE", "COMPLETION", "OTHER"];

export async function uploadAttachment(formData: FormData) {
  const user = await requireUser();
  const ticketId = formData.get("ticketId") as string;
  if (!ticketId) throw new Error("Missing ticket");

  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    select: { id: true, code: true },
  });

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("No file provided");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Only JPEG, PNG, or WEBP images are allowed");
  if (file.size > MAX_SIZE) throw new Error("File is too large (max 8MB)");

  const kindRaw = (formData.get("kind") as string) || "INTAKE";
  const kind = ATTACHMENT_KINDS.includes(kindRaw) ? kindRaw : "INTAKE";
  const isPublic = formData.get("isPublic") === "on";

  const dir = path.join(process.cwd(), "public", "uploads", "tickets", ticket.id);
  await mkdir(dir, { recursive: true });

  // Never trust the user-supplied filename — generate our own.
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  await db.attachment.create({
    data: {
      ticketId: ticket.id,
      path: `/uploads/tickets/${ticket.id}/${filename}`,
      kind,
      isPublic,
      createdById: user.id,
    },
  });

  revalidatePath(`/dashboard/tickets/${ticket.id}`);
  revalidatePath(`/track/${ticket.code}`);
}

export async function deleteAttachment(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id") as string;

  const attachment = await db.attachment.findUniqueOrThrow({
    where: { id },
    include: { ticket: { select: { code: true } } },
  });

  if (user.role !== "ADMIN" && attachment.createdById !== user.id) {
    throw new Error("Forbidden");
  }

  try {
    await unlink(path.join(process.cwd(), "public", attachment.path));
  } catch {
    // best-effort — the DB row is the source of truth
  }

  await db.attachment.delete({ where: { id } });

  revalidatePath(`/dashboard/tickets/${attachment.ticketId}`);
  revalidatePath(`/track/${attachment.ticket.code}`);
}
