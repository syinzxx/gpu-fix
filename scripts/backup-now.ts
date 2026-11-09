/**
 * Backs up the shop database now, the same way the app does each day.
 *   npm run backup
 */
import { backupNow, defaultOptions, listBackups } from "../lib/backup";

const options = defaultOptions();
const result = backupNow(options);
console.log(`Saved ${result.name} (${(result.bytes / 1048576).toFixed(1)} MB)`);
for (const copy of result.copies) console.log(`  ${copy.ok ? "ok    " : "FAILED"} ${copy.dir}${copy.error ? `: ${copy.error}` : ""}`);
console.log(`Copies kept: ${options.dirs.map((dir) => `${dir} ${listBackups([dir]).length}`).join(", ")}`);
