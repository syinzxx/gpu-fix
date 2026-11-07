import { normalise } from "./normalise";

export type FileType = "BOARDVIEW" | "SCHEMATIC" | "BOARDVIEW_PDF" | "BIOS" | "OTHER" | "IGNORED";
export type BrandSource = "name" | "folder" | "product" | "code" | "none";

export type Classification = {
  fileType: FileType;
  gpuMaker: string;
  generation: string;
  gpuModel: string;
  otherModels: string[];
  /** "name" means the file itself names the GPU, which beats a folder. */
  modelSource: "name" | "folder" | "none";
  cardBrand: string;
  brandSource: BrandSource;
  cardName: string;
  boardCode: string | null;
  revision: string | null;
  aliases: string[];
  identityKey: string | null;
  /** Null when the file can go straight into the library. */
  reviewReason: string | null;
};

const BOARDVIEW_EXT = new Set([".cad", ".tvw", ".fz", ".pcb", ".bdv", ".faz", ".brd", ".asc", ".bv", ".cst"]);
const IMAGE_OR_ARCHIVE_EXT = new Set([".jpg", ".jpeg", ".png", ".rar", ".zip", ".7z"]);
const BIOS_EXT = new Set([".rom", ".bin"]);
const SKIP_NAMES = new Set(["thumbs.db", "desktop.ini"]);
const SKIP_EXT = new Set([".exe", ".msi", ".ini", ".db", ".html", ".htm", ".txt", ".ppt", ".pptx", ".url", ".sqlite3", ".obdlocal"]);

const BRANDS: [string, RegExp][] = [
  ["MSI", /\bMSI\b/],
  ["Gigabyte", /\bGIGABYTE\b/],
  ["ASRock", /\bASROCK\b/],
  ["ASUS", /\bASUS\b/],
  ["Sapphire", /\bSAPPHIRE\b/],
  ["EVGA", /\bEVGA\b/],
  ["Zotac", /\bZOTAC\b/],
  ["PNY", /\bPNY\b/],
  ["Palit", /\bPALIT\b/],
  ["Gainward", /\bGAINWARD\b/],
  ["Inno3D", /\bINNO ?3D\b/],
  ["Colorful", /\b(COLORFUL|IGAME)\b/],
  ["Galax", /\b(GALAX|GALAXY|KFA2)\b/],
  ["PowerColor", /\bPOWERCOLOR\b/],
  ["XFX", /\bXFX\b/],
];

// Names that point to one maker's product line even when the brand is not written.
const PRODUCT_BRANDS: [string, RegExp][] = [
  ["MSI", /\bMS-? ?V\d{3}\b/],
  ["Gigabyte", /\bGV-? ?[NR]|\bAORUS\b|\bN\d{3}[TS]\b|\bN\d{3,4}[A-Z]*[ -]?(OC|GAMING|EAGLE|AERO|WF\d)/],
  ["ASRock", /\b(TAICHI|PHANTOM GAMING)\b/],
  ["Sapphire", /\bNITRO\+?\b/],
  ["ASUS", /\b(ROG|TUF|STRIX)\b|\bCG\d{3}|\b59YV|\b60-?[A-Z0-9]{2}\d|\bEAH\d/],
  ["NVIDIA reference", /\b(FOUNDERS|PG\d{3}|\d{4} ?FE)\b/],
];

const CARD_NAMES = [
  "ROG ASTRAL", "ROG STRIX", "ROG MATRIX", "TUF GAMING", "TUF", "SUPRIM X", "GAMING X TRIO", "GAMING X", "GAMING TRIO",
  "VENTUS 3X", "VENTUS 2X", "VENTUS", "AORUS MASTER", "AORUS", "AERO OC", "EAGLE OC", "EAGLE", "WINDFORCE",
  "GAMING OC", "PHANTOM GAMING", "TAICHI", "CHALLENGER", "NITRO+", "NITRO", "PULSE",
];
const KEEP_CAPS = new Set(["ROG", "TUF", "OC"]);

const clean = (text: string) => text.replace(/_/g, " ").toUpperCase();

function displayCase(text: string) {
  return text.replace(/[A-Z]+/g, (word) =>
    KEEP_CAPS.has(word) || word.length === 1 ? word : word[0] + word.slice(1).toLowerCase()
  );
}

const SUFFIX: Record<string, string> = { TI: "Ti", SUPER: "Super", S: "Super", XT: "XT", XTX: "XTX" };

function modelName(prefix: string, number: string, suffix?: string) {
  const label = prefix === "ARC" ? "Arc" : prefix;
  return [label, number, suffix ? SUFFIX[suffix] : ""].filter(Boolean).join(" ");
}

const pushUnique = (list: string[], value: string) => {
  if (!list.includes(value)) list.push(value);
};

/** Finds written GPU names, including ranges such as "GTX 1070-1070 Ti". */
function modelsInText(text: string): string[] {
  const found: string[] = [];
  const pattern =
    /\b(RTX|GTX|GTS|GT|RX|R9|R7|R5|HD|ARC) ?-? ?(A?\d{3,4})(?: ?-? ?(TI|SUPER|XTX|XT|S)(?![A-Z0-9]))?(?: ?- ?(\d{3,4})(?: ?(TI|SUPER|XTX|XT|S)(?![A-Z0-9]))?)?/g;
  for (const m of text.matchAll(pattern)) {
    pushUnique(found, modelName(m[1], m[2], m[3]));
    if (m[4]) pushUnique(found, modelName(m[1], m[4], m[5]));
  }
  for (const m of text.matchAll(/\bVEGA ?(\d{2})\b/g)) pushUnique(found, `RX Vega ${m[1]}`);
  for (const m of text.matchAll(/\bQUADRO ?([A-Z]{0,3}\d{3,4})\b/g)) pushUnique(found, `Quadro ${m[1]}`);
  for (const m of text.matchAll(/\bTESLA ?([A-Z]?\d{2,4})\b/g)) pushUnique(found, `Tesla ${m[1]}`);
  for (const m of text.matchAll(/\bRADEON ?(\d{3})\b/g)) pushUnique(found, `Radeon ${m[1]}`);
  for (const m of text.matchAll(/\b(P10[46])[ -](\d{3})\b/g)) pushUnique(found, `${m[1]}-${m[2]}`);
  if (/\bTITAN\b/.test(text)) pushUnique(found, "GTX Titan");
  return found;
}

const mentioned = (name: string, model: string) => name.includes(model.match(/\d{3,4}/)?.[0] ?? "\0");

const nvidiaPrefix = (number: number) => (number >= 2000 ? "RTX" : "GTX");

/** Gigabyte short names: N4090, N306T (3060 Ti), N166S (1660 Super). */
function gigabyteModel(text: string): string | null {
  const m = text.match(/\bN(\d{3,4})(T|S)?(?=[A-Z0-9 -]|$)/);
  if (!m) return null;
  const digits = m[1];
  const suffix = m[2] === "T" ? "TI" : m[2];
  // N980T is a GTX 980 Ti, while N306T is an RTX 3060 Ti.
  if (digits.length === 3 && (!m[2] || Number(digits) >= 600)) return modelName("GTX", digits, suffix);
  const full = Number(digits.length === 3 ? `${digits}0` : digits);
  return modelName(nvidiaPrefix(full), String(full), suffix);
}

/** Folders named only by number, such as "5090" or "3080-3090". */
function modelsFromBareFolder(folder: string, isAmd: boolean): string[] {
  const m = folder.match(/^(\d{3,4})(?: ?(TI|XTX|XT|SUPER|S))?(?: ?- ?(\d{3,4})(?: ?(TI|XTX|XT|SUPER|S))?)?$/);
  if (!m) return [];
  const prefix = (n: string) => (isAmd ? "RX" : nvidiaPrefix(Number(n)));
  const list = [modelName(prefix(m[1]), m[1], m[2])];
  if (m[3]) list.push(modelName(prefix(m[3]), m[3], m[4]));
  return list;
}

function makerFor(model: string, top: string, segments: string[]): string {
  if (/^(RTX|GTX|GTS|GT|Quadro|Tesla|P10\d-)/.test(model)) return "NVIDIA";
  if (/^(RX|R9|R7|R5|HD|Radeon) /.test(model)) return "AMD";
  if (model.startsWith("Arc ")) return "Intel";
  const head = top.replace("#", "").toUpperCase();
  if (head === "AMD") return segments.some((s) => /QUADRO/i.test(s)) ? "NVIDIA" : "AMD";
  if (head === "INTEL") return "Intel";
  if (head === "RETRO") return "Retro";
  return "NVIDIA";
}

function generationFor(model: string): string {
  const m = model.match(/^(RTX|GTX|GTS|GT|RX|R9|R7|R5|HD) (\d{3,4})/);
  if (!m) return model.split(" ").slice(0, 2).join(" ") || "Unidentified";
  const n = Number(m[2]);
  if (m[1] === "RTX") return `RTX ${Math.floor(n / 1000)}000`;
  if (m[1] === "RX" && n >= 1000) return `RX ${Math.floor(n / 1000)}000`;
  if (m[1] === "RX") return "RX 400-500";
  if (m[1] === "GTX" && n >= 1600 && n < 1700) return "GTX 1600";
  if (m[1] === "GTX" && n >= 1000 && n < 1600) return "GTX 1000";
  if (m[1] === "GTX" || m[1] === "GTS") return "GTX 900 and older";
  if (m[1] === "GT") return "GT 700 and older";
  if (m[1] === "R5" || m[1] === "R7") return "R5 and R7";
  return "Radeon HD and R9";
}

function findBrand(name: string, folders: string[]): { brand: string; source: BrandSource } {
  const hit = (text: string, list: [string, RegExp][]) => list.find(([, re]) => re.test(text))?.[0];
  const insideOut = [...folders].reverse();
  const fromName = hit(name, BRANDS);
  if (fromName) return { brand: fromName, source: "name" };
  for (const folder of insideOut) {
    const found = hit(folder, BRANDS);
    if (found) return { brand: found, source: "folder" };
  }
  for (const text of [name, ...insideOut]) {
    const found = hit(text, PRODUCT_BRANDS);
    if (found) return { brand: found, source: "product" };
  }
  for (const text of [name, ...insideOut]) {
    if (/\b\d?V\d{3}\b/.test(text)) return { brand: "MSI", source: "code" };
  }
  return { brand: "", source: "none" };
}

function findCode(name: string, folders: string[], brand: string): string | null {
  for (const text of [name, ...[...folders].reverse()]) {
    const ms = text.match(/\bMS-? ?V?(\d{3})\b/);
    if (ms) return `MS-V${ms[1]}`;
    if (brand === "MSI") {
      const v = text.match(/\b\d?V(\d{3})\b/);
      if (v) return `MS-V${v[1]}`;
    }
    const gv = text.match(/\bGV-? ?((?:[NR][A-Z0-9]+)(?:[ -][A-Z0-9]+)*?-\d+G[A-Z]?\d*)/);
    if (gv) return `GV-${gv[1].replace(/ +/g, "-")}`;
    const asus = text.match(/\b(CG\d{3,4}[A-Z]{0,3}\d?|[CDB]\d{3,4}[A-Z]{1,3})\b/);
    if (asus) return asus[1];
    const pg = text.match(/\bPG\d{3}\b/);
    if (pg) return pg[0];
  }
  return null;
}

function findRevision(rawName: string): string | null {
  const name = clean(rawName);
  const written = name.match(/\bREV[ .]*V?(\d+(?:\.\d+| \d{1,2}(?=X? |X?$))?X?)/);
  if (written) {
    const value = written[1].replace(" ", ".");
    return /^\d\d$/.test(value) ? `${value[0]}.${value[1]}` : value; // "Rev10" means 1.0
  }
  const short = name.match(/\bR(\d\.\d+X?)\b/);
  if (short) return short[1];
  const dotted = name.match(/(?:^| |-)(\d\.\d{1,2}X?)(?= |$)/);
  if (dotted) return dotted[1];
  const msiPair = name.match(/\bV\d{3} (\d)(\d)\b/);
  if (msiPair) return `${msiPair[1]}.${msiPair[2]}`;
  const giga = name.match(/-\d+G[A-Z]?\d* ?-? ?(\d)(\d{1,2})(?= NP|$)/);
  if (giga) return `${giga[1]}.${giga[2]}`;
  return null;
}

/** Only the two nearest folders, because anything further out covers many boards. */
function findRevisionInFolders(folders: string[]): string | null {
  for (const folder of folders.slice(-2).reverse()) {
    const found = findRevision(folder);
    if (found) return found;
  }
  return null;
}

/** The file name without copy markers and type words, so a board's PDF and CAD share one stem. */
export function comparableStem(stem: string): string {
  return normalise(
    clean(stem)
      .replace(/\(COPY \d+\)|\(\d+\)|\bCOPY \d+\b/g, " ")
      .replace(/\b(DECRYPT|BOARD ?VIEW|SCHEMATICS?|BV|NP|PDFX?)\b/g, " ")
      .replace(/\(\.?[A-Z]{2,3}\)/g, " ")
  );
}

function typeOf(name: string, ext: string): FileType {
  if (SKIP_NAMES.has(name.toLowerCase()) || SKIP_EXT.has(ext) || /\.(obd|sql)/i.test(name)) return "IGNORED";
  if (BOARDVIEW_EXT.has(ext)) return "BOARDVIEW";
  if (BIOS_EXT.has(ext)) return "BIOS";
  if (IMAGE_OR_ARCHIVE_EXT.has(ext)) return "OTHER";
  if (ext === ".pdf") return /BOARD ?VIEW|\bBV\b/.test(clean(name)) ? "BOARDVIEW_PDF" : "SCHEMATIC";
  return "OTHER";
}

export function aliasesForModels(models: string[], code: string | null, brand: string): string[] {
  const list: string[] = [];
  for (const model of models) {
    pushUnique(list, model);
    pushUnique(list, model.replace(/ /g, ""));
    const m = model.match(/^(?:RTX|GTX) (\d{3,4})(?: (Ti|Super))?$/);
    if (m) {
      pushUnique(list, `N${m[1]}${m[2] ?? ""}`);
      if (m[2]) pushUnique(list, `N${m[1].slice(0, -1)}${m[2][0]}`);
    }
  }
  if (code) pushUnique(list, code);
  if (code?.startsWith("MS-V")) pushUnique(list, code.slice(3));
  if (brand && models[0]) pushUnique(list, `${brand} ${models[0]}`);
  return list;
}

/** V-numbered parts write revision 3.0 as "30", matching the main library needs the dot. */
function retroRevision(code: string, revision: string): string {
  if (!code.startsWith("V")) return revision;
  if (/^\d\d$/.test(revision)) return `${revision[0]}.${revision[1]}`;
  return /^\d$/.test(revision) ? `${revision}.0` : revision;
}

function classifyRetro(stem: string, folders: string[], fileType: FileType): Classification {
  const brand = folders.some((f) => /\bMSI\b/.test(f)) ? "MSI" : "";
  const m = clean(stem).match(/^(?:MS[ -]?)?([A-Z]?\d{3,4})(?:[ -]*([0-9.]+[A-Z]?)(?![A-Z0-9]))?/);
  const code = brand && m ? `MS-${m[1]}` : null;
  const revision = m?.[2] ? retroRevision(m[1], m[2]) : null;
  return {
    fileType,
    gpuMaker: "Retro",
    generation: "Early graphics",
    gpuModel: "Unidentified",
    otherModels: [],
    modelSource: "none",
    cardBrand: brand,
    brandSource: brand ? "folder" : "none",
    cardName: "",
    boardCode: code,
    revision,
    aliases: code ? [code, code.slice(3)] : [],
    identityKey: code ? `${brand}|${code}|${revision ?? ""}` : null,
    reviewReason: code ? null : "Nothing in the name identifies a board.",
  };
}

export function classify(relativePath: string, size = 1): Classification {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  const rawName = segments[segments.length - 1];
  const dot = rawName.lastIndexOf(".");
  const ext = dot >= 0 ? rawName.slice(dot).toLowerCase() : "";
  const stem = dot >= 0 ? rawName.slice(0, dot) : rawName;
  const name = clean(stem);
  const folders = segments.slice(0, -1).filter((f) => f.toLowerCase() !== "extra copies").map(clean);
  const fileType = typeOf(rawName, ext);
  const top = segments[0];

  if (top.toUpperCase() === "RETRO" && folders.some((f) => /\bMSI\b/.test(f))) {
    return classifyRetro(stem, folders, fileType);
  }

  const isAmdRoot = /^#?AMD$/i.test(top);
  const namedFolders = folders.filter((f) => !/SERIES/.test(f));
  let models = modelsInText(name);
  const short = models.length ? null : gigabyteModel(name);
  if (short) models = [short];
  const modelFromName = models.length > 0;
  for (const folder of [...namedFolders].reverse()) {
    if (models.length) break;
    models = [...modelsInText(folder), ...modelsFromBareFolder(folder, isAmdRoot)];
    const fromFolder = models.length ? null : gigabyteModel(folder);
    if (fromFolder) models = [fromFolder];
  }
  // A shared folder such as "3080-3090": prefer the number the file mentions.
  models.sort((x, y) => Number(mentioned(name, y)) - Number(mentioned(name, x)));

  const gpuModel = models[0] ?? "";
  const { brand, source } = findBrand(name, namedFolders);
  const code = findCode(name, namedFolders, brand);
  const revision = findRevision(stem) ?? findRevisionInFolders(namedFolders);
  const haystack = `${name} ${[...namedFolders].reverse().join(" ")}`;
  const cardName = CARD_NAMES.find((c) => haystack.includes(c)) ?? "";

  // Photos and archives never define a board on their own, so "Capture2.JPG" is not a card.
  const identityKey = code
    ? `${brand}|${code}|${revision ?? ""}`
    : brand && gpuModel && fileType !== "OTHER"
      ? `${brand}|${normalise(gpuModel)}|${comparableStem(stem)}`
      : null;

  const result: Classification = {
    fileType,
    gpuMaker: makerFor(gpuModel, top, segments),
    generation: gpuModel ? generationFor(gpuModel) : "Unidentified",
    gpuModel: gpuModel || "Unidentified",
    otherModels: models.slice(1),
    modelSource: modelFromName ? "name" : gpuModel ? "folder" : "none",
    cardBrand: brand,
    brandSource: source,
    cardName: displayCase(cardName),
    boardCode: code,
    revision,
    aliases: aliasesForModels(models, code, brand),
    identityKey,
    reviewReason: null,
  };
  result.reviewReason = reviewReasonFor(result, size);
  return result;
}

function reviewReasonFor(c: Classification, size: number, brandConfirmed = false): string | null {
  if (c.gpuMaker === "Retro" && c.boardCode) return size === 0 ? "The file is empty." : null;
  if (!c.identityKey && c.fileType === "OTHER") return null; // loose photos are kept but need no decision
  const reasons: string[] = [];
  if (!c.cardBrand) reasons.push("The brand could not be worked out.");
  if (c.gpuModel === "Unidentified") reasons.push("The GPU could not be worked out.");
  if (size === 0) reasons.push("The file is empty.");
  if (c.brandSource === "code" && !brandConfirmed) reasons.push("Only a V number in the name, so the brand is a guess.");
  return reasons.length ? reasons.join(" ") : null;
}

/** Maker and generation for a GPU typed by hand. */
export function describeModel(gpuModel: string) {
  return { gpuMaker: makerFor(gpuModel, "", []), generation: generationFor(gpuModel) };
}

export type Scanned = { size: number; c: Classification };

/**
 * Second pass over every file. A board code means the same board wherever it
 * appears, so a file named only "V330_63.cad" learns its GPU from the files
 * that spell it out, and folder guesses give way to what the files say.
 */
export function resolveAcrossFiles<T extends Scanned>(items: T[]): T[] {
  const named = new Map<string, Map<string, number>>();
  const firmCodes = new Set<string>();
  for (const { c } of items) {
    if (!c.boardCode || c.gpuMaker === "Retro") continue;
    if (c.brandSource !== "code") firmCodes.add(c.boardCode);
    if (c.modelSource !== "name") continue;
    const counts = named.get(c.boardCode) ?? new Map<string, number>();
    for (const model of [c.gpuModel, ...c.otherModels]) {
      counts.set(model, (counts.get(model) ?? 0) + (model === c.gpuModel ? 2 : 1));
    }
    named.set(c.boardCode, counts);
  }
  return items.map((item) => {
    const { c, size } = item;
    if (!c.boardCode) return item;
    const counts = named.get(c.boardCode);
    if (c.gpuMaker === "Retro" && !counts) return item;
    const next = { ...c };
    if (counts) {
      const models = [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([m]) => m);
      next.gpuModel = models[0];
      next.otherModels = models.slice(1);
      next.modelSource = "name";
      next.generation = generationFor(models[0]);
      next.gpuMaker = makerFor(models[0], "", []);
      next.aliases = aliasesForModels(models, c.boardCode, c.cardBrand);
    }
    next.reviewReason = reviewReasonFor(next, size, firmCodes.has(c.boardCode));
    return { ...item, c: next };
  });
}
