import type { ReadingRow } from "./measurements";

/**
 * The NO DISPLAY checks in bench order. Names come from nets read off real
 * boardviews (2026-11-07), which differ from PDF text: reset is PEX_RST* on a
 * board but PEX_RST# in a schematic. A step tries each name until NexusBV finds
 * one on the open board, because one job can have several names: AMD core is
 * +VDDC on older cards and +VDDCR_GFX on newer ones.
 */
export type FaultStep = { key: string; nets: string[] };

const NVIDIA_STEPS: FaultStep[] = [
  { key: "power12v", nets: ["12V", "12V_F", "PEX_12V", "NV12V"] },
  { key: "pcieReset", nets: ["PEX_RST*", "PEX_RST_BUF*", "PEX_RST#", "PEX_RST"] },
  { key: "pcieClock", nets: ["PEX_REFCLK", "PEX_REFCLK*"] },
  { key: "gpuClock", nets: ["XTALIN", "XTAL_IN"] },
  { key: "gpuCore", nets: ["NVVDD", "+NVVDD", "VDDC"] },
  { key: "memoryPower", nets: ["FBVDDQ", "FBVDD"] },
  { key: "rail1v8", nets: ["1V8_AON", "1V8_MAIN", "1V8", "NP1V8", "1V8_MISC"] },
  {
    key: "memoryRef",
    nets: ["FB_VREF", "GPU_FB_VREF", "FBA_VREFC", "FBA_VREF", "FBA_VREFC0", "FBA_VREFC_0_H", "FBA_VREF_C_H", "FBA_VREF_Q"],
  },
];

const AMD_STEPS: FaultStep[] = [
  { key: "power12v", nets: ["+12V_BUS", "+12V_EXT_A", "+12V_EXT", "+12V"] },
  { key: "pcieReset", nets: ["PERST#", "PERST#_BUF", "PERSTB_BUF", "PERSTB"] },
  { key: "pcieClock", nets: ["PCIE_REFCLKP", "PCIE_REFCLKN", "REFCLKP"] },
  { key: "gpuClock", nets: ["XTALIN", "XO_IN", "XOUT_OSC"] },
  { key: "gpuCore", nets: ["+VDDCR_GFX", "VDDCR_GFX", "+VDDGFX", "VDDGFX", "+VDDC", "VDDC"] },
  { key: "memoryPower", nets: ["+VDD_MEM", "VDD_MEM", "+MVDD", "MVDD", "MVDDQ", "+VDDCI", "VDDCI"] },
  { key: "rail1v8", nets: ["+1.8V", "+1V8", "1V8", "+1.8V_S5", "VDD_18"] },
  { key: "memoryRef", nets: ["VREFC_A", "VREFC_A0", "MVREF_A", "MVREFDA", "MVREFDCD", "VREFC"] },
];

export function faultStepsFor(gpuMaker: string): FaultStep[] {
  if (gpuMaker === "NVIDIA") return NVIDIA_STEPS;
  if (gpuMaker === "AMD") return AMD_STEPS;
  return [];
}

/** Saved readings for any of a step's names, so the check shows what to expect. */
export function readingsForStep(step: FaultStep, rows: ReadingRow[]): ReadingRow[] {
  const names = new Set(step.nets.map((net) => net.toUpperCase()));
  return rows.filter((row) => names.has(row.target.toUpperCase()));
}
