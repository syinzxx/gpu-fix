"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { backupNow, type CopyResult } from "@/lib/backup";

export type BackupState = { name?: string; copies?: CopyResult[]; error?: string };

export async function runBackup(): Promise<BackupState> {
  await requireRole("ADMIN");
  try {
    const result = backupNow();
    revalidatePath("/dashboard/settings");
    return { name: result.name, copies: result.copies };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
