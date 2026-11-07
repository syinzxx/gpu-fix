import assert from "node:assert/strict";
import { test } from "node:test";
import { faultStepsFor, readingsForStep } from "./faults";
import { summarise } from "./measurements";

test("each maker gets the same checks in the same order, with its own names", () => {
  const nvidia = faultStepsFor("NVIDIA");
  const amd = faultStepsFor("AMD");
  assert.deepEqual(nvidia.map((s) => s.key), amd.map((s) => s.key));
  assert.equal(nvidia.find((s) => s.key === "gpuCore")?.nets[0], "NVVDD");
  assert.ok(amd.find((s) => s.key === "gpuCore")?.nets.includes("+VDDCR_GFX"));
  assert.ok(amd.find((s) => s.key === "gpuCore")?.nets.includes("+VDDC"));
});

test("makers without a list get no shortcut", () => {
  assert.deepEqual(faultStepsFor("Retro"), []);
  assert.deepEqual(faultStepsFor("Intel"), []);
});

test("a step finds readings saved under any of its names, in any case", () => {
  const rows = summarise([
    { target: "fbvdd", mode: "DIODE", polarity: "RED_ON_GROUND", condition: "GOOD", value: 0.3 },
    { target: "NVVDD", mode: "DIODE", polarity: "RED_ON_GROUND", condition: "GOOD", value: 0.1 },
  ]);
  const step = faultStepsFor("NVIDIA").find((s) => s.key === "memoryPower");
  assert.ok(step);
  assert.deepEqual(readingsForStep(step, rows).map((r) => r.target), ["FBVDD"]);
});
