"use server";

import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export type PasswordState = { ok?: boolean; error?: "wrong" | "short" | "mismatch" | "same" };

const MIN_LENGTH = 8;

export async function changePassword(_previous: PasswordState, form: FormData): Promise<PasswordState> {
  const { id } = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const repeat = String(form.get("repeat") ?? "");

  const user = await db.user.findUniqueOrThrow({ where: { id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "wrong" };
  if (next.length < MIN_LENGTH) return { error: "short" };
  if (next !== repeat) return { error: "mismatch" };
  if (next === current) return { error: "same" };

  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true };
}
