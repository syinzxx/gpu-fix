import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import { INDEX_PATH } from "./text-index";

/** The reading job writes this while it runs, so a second one is never started. */
export const LOCK_PATH = `${INDEX_PATH}.running`;

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function indexingRunning(): boolean {
  if (!fs.existsSync(LOCK_PATH)) return false;
  const pid = Number(fs.readFileSync(LOCK_PATH, "utf8"));
  return Number.isFinite(pid) && alive(pid);
}

export function nexusRunning(): boolean {
  try {
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq NexusBV.exe", "/FO", "CSV", "/NH"], { windowsHide: true }).toString();
    return /"NexusBV\.exe"/i.test(out);
  } catch {
    return false;
  }
}

/** Starts `npm run library:index` in the background. It reads only PDFs not yet read. */
export function startPdfIndexing() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const job = spawn(npm, ["run", "-s", "library:index"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: process.platform === "win32",
  });
  job.on("error", () => {});
  job.unref();
}
