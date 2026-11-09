/**
 * Adds the graphics card hints to NexusBV's diagnostic_hints.yaml.
 *   npm run nexusbv:hints
 * Keeps a dated copy of the original first, and does nothing if the hints are already there.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = process.env.NEXUSBV_DIR ?? path.join(os.homedir(), "Desktop", "NexusBV 0.9");
const target = path.join(dir, "diagnostic_hints.yaml");
const hints = fs.readFileSync(path.join(__dirname, "..", "desktop", "nexusbv-gpu-hints.yaml"), "utf8");

const current = fs.readFileSync(target, "utf8");
if (/^\s{2}graphics_cards:/m.test(current)) {
  console.log("The graphics card hints are already in NexusBV.");
} else if (!/^categories:/m.test(current)) {
  throw new Error("The NexusBV hints file has an unexpected layout, so it was left unchanged.");
} else {
  const backup = `${target}.before-gpu-hints-${new Date().toISOString().slice(0, 10)}`;
  fs.copyFileSync(target, backup);
  fs.writeFileSync(target, `${current.replace(/\s*$/, "")}\n\n${hints}`);
  console.log(`Added graphics card hints. The original is saved as ${path.basename(backup)}.`);
}
