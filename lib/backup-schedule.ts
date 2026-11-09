import { backupNow, defaultOptions, isDue } from "./backup";

const CHECK_EVERY_MS = 60 * 60 * 1000;
const DUE_AFTER_HOURS = 24;
const FIRST_CHECK_MS = 60 * 1000; // let the server finish starting first

declare global {
  var gpuFixBackupTimer: NodeJS.Timeout | undefined;
}

function runIfDue() {
  const options = defaultOptions();
  if (!isDue(options.dirs, DUE_AFTER_HOURS)) return;
  try {
    const result = backupNow(options);
    const failed = result.copies.filter((c) => !c.ok);
    console.log(`[backup] saved ${result.name}${failed.length ? `, could not copy to ${failed.map((c) => c.dir).join(", ")}` : ""}`);
  } catch (error) {
    console.error("[backup] failed:", error);
  }
}

/** Once a day while the server runs. A dev reload does not start a second timer. */
export function startBackupSchedule() {
  if (globalThis.gpuFixBackupTimer) return;
  setTimeout(runIfDue, FIRST_CHECK_MS).unref();
  globalThis.gpuFixBackupTimer = setInterval(runIfDue, CHECK_EVERY_MS);
  globalThis.gpuFixBackupTimer.unref();
}
