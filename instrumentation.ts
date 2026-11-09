/** Runs once when the server starts. Starts the daily database backup. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.BACKUP_DISABLED === "1") return;
  const { startBackupSchedule } = await import("./lib/backup-schedule");
  startBackupSchedule();
}
