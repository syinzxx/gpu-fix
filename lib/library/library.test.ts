import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, resolveAcrossFiles } from "./classify";
import { matchesAllWords, naturalCompare, normalise } from "./normalise";

test("search words match regardless of spaces, dashes and case", () => {
  const { aliases } = classify("NVIDIA/8 - RTX 5000 series/5070/GV-N5070GAMING OC-12GD_1.0.tvw");
  const fields = aliases.map(normalise);
  for (const query of ["RTX 5070", "RTX5070", "rtx-5070", "N5070"]) {
    assert.ok(matchesAllWords(query, fields), query);
  }
  assert.equal(matchesAllWords("RTX 4090", fields), false);
});

test("numbers sort as numbers", () => {
  assert.deepEqual(["10", "2", "1.10", "1.2"].sort(naturalCompare), ["1.2", "1.10", "2", "10"]);
});

test("Gigabyte short names resolve to the real GPU", () => {
  const ti = classify("3060/N306TGAMINGOC PRO-8GD-30.pdf");
  assert.equal(ti.gpuModel, "RTX 3060 Ti");
  assert.equal(ti.cardBrand, "Gigabyte");
  const big = classify("4090/N4090GAMING-24GD_1.0.pdf");
  assert.equal(big.gpuModel, "RTX 4090");
  assert.equal(big.cardBrand, "Gigabyte");
  assert.equal(classify("x/GV-N166SOC-6GD.rom").gpuModel, "GTX 1660 Super");
});

test("Quadro is NVIDIA even inside the AMD folder", () => {
  assert.equal(classify("#AMD/Quadro/MS-V378 REV 1.0.cad").gpuMaker, "NVIDIA");
});

test("shared folders are split by the card named in the file", () => {
  assert.equal(classify("3080-3090/TUF-RTX3090-24G schematic.pdf").gpuModel, "RTX 3090");
  assert.equal(classify("2060-2070/MSI RTX 2070 V373 rev 1.0.cad").gpuModel, "RTX 2070");
});

test("bare GPU folders give the GPU when the file does not", () => {
  assert.equal(classify("NVIDIA/8 - RTX 5000 series/5090/Gigabyte 5090 WINDFORCE.tvw").gpuModel, "RTX 5090");
  assert.equal(classify("#AMD/6800 XT/Asrock_Radeon_Phantom_Gaming_r1.0.fz").gpuModel, "RX 6800 XT");
});

test("a range of GPUs keeps both names", () => {
  const c = classify("MSI/MSI V330 - GeForce/MSI V330 GTX 1070-1070 Ti rev 7.0.pcb");
  assert.equal(c.gpuModel, "GTX 1070");
  assert.deepEqual(c.otherModels, ["GTX 1070 Ti"]);
  assert.equal(c.fileType, "BOARDVIEW");
});

test("a board's PDF and boardview share one identity, across copies", () => {
  const pdf = classify("MSI/MSI V328 - GTX 1060/MSI V328 GTX 1060 rev 6.1 Decrypt (2).pdf");
  const cad = classify("MSI/MSI V328 - GTX 1060/extra copies/MSI V328 GTX 1060 rev 6.1 (copy 3).cad");
  assert.equal(pdf.identityKey, cad.identityKey);
  assert.equal(pdf.boardCode, "MS-V328");
  assert.equal(pdf.revision, "6.1");
});

test("boards without a code pair up by file name", () => {
  const a = classify("x/ASUS/ASUS GTX750TI CARD Rev 1.00 BoardView.tvw");
  const b = classify("x/ASUS/ASUS GTX750TI CARD Rev 1.00.pdf");
  assert.equal(a.identityKey, b.identityKey);
});

test("revisions are read from each naming style", () => {
  assert.equal(classify("1060/V328_30(00017967)_Decrypt.pdf").revision, "3.0");
  assert.equal(classify("x/ASRock_RX_7900_XTX_REV_1_01_70_GA3Y00.CAD").revision, "1.01");
  assert.equal(classify("x/GV-N5080AERO OC-16GD_10_NP.pdf").revision, "1.0");
  assert.equal(classify("x/GV-RX580GAMING-8GD r1.0.pdf").revision, "1.0");
});

test("a bare V number is only a guess and waits in the Inbox", () => {
  const c = classify("1060/v328_30.cad");
  assert.equal(c.cardBrand, "MSI");
  assert.equal(c.brandSource, "code");
  assert.match(c.reviewReason ?? "", /guess/);
});

test("an MS-V code or MSI folder needs no Inbox stop", () => {
  assert.equal(classify("1060/MS-V328 REV 1.0.cad").reviewReason, null);
  assert.equal(classify("GTX 1060/MSI/V328_30.cad").reviewReason, null);
});

test("unidentified and empty files wait in the Inbox", () => {
  assert.ok(classify("NVIDIA/scan_0042.pdf").reviewReason);
  assert.match(classify("GTX 1060/MSI/V328_30.cad", 0).reviewReason ?? "", /empty/);
});

test("installers and viewer leftovers are skipped", () => {
  for (const f of ["x/Tool Setup.exe", "x/Thumbs.db", "x/desktop.ini", "x/link.txt", "x/A.html", "x/board.obdlocal.sqlite3"]) {
    assert.equal(classify(f).fileType, "IGNORED", f);
  }
});

test("BIOS and boardview PDFs get their own types", () => {
  assert.equal(classify("x/Zotac GTX 1060.rom").fileType, "BIOS");
  assert.equal(classify("x/ASUS GTX 750 BoardView.pdf").fileType, "BOARDVIEW_PDF");
});

const scan = (...paths: string[]) => resolveAcrossFiles(paths.map((p) => ({ size: 1, c: classify(p) })));

test("a board code shares its GPU with files that do not name one", () => {
  const [, bare] = scan("MSI/MSI V330 GTX 1070-1070 Ti rev 7.0.pcb", "x/V330_63.cad");
  assert.equal(bare.c.gpuModel, "GTX 1070");
  assert.equal(bare.c.reviewReason, null);
});

test("what files say about a code beats a shared folder", () => {
  const [, foldered] = scan("MSI/MSI V373 RTX 2070 rev 3.0.cad", "2060-2080/MS-V373 REV 2.0.cad");
  assert.equal(foldered.c.gpuModel, "RTX 2070");
});

test("a V number on a code known as MSI stops being a guess", () => {
  const [, bare] = scan("GTX 1060/MSI/MSI V328 GTX 1060 rev 1.0.cad", "1060/v328_30.cad");
  assert.equal(bare.c.reviewReason, null);
});

test("a V number seen nowhere else stays a guess", () => {
  const [only] = scan("1060/v999_30.cad");
  assert.match(only.c.reviewReason ?? "", /guess/);
});

test("N980T is a GTX 980 Ti, not an RTX card", () => {
  assert.equal(classify("x/GV-N980TXTREME-6GD.pdf").gpuModel, "GTX 980 Ti");
  assert.equal(classify("x/GV-N207SOC-8GC.pdf").gpuModel, "RTX 2070 Super");
});

test("a shared folder takes the number the file mentions", () => {
  assert.equal(classify("3080-3090/3090FE.pdf").gpuModel, "RTX 3090");
});

test("retro part numbers keep the full revision", () => {
  const c = classify("Retro/MSI Early graphics/V207-5.0.pdf");
  assert.equal(c.boardCode, "MS-V207");
  assert.equal(c.revision, "5.0");
  assert.equal(c.reviewReason, null);
});

test("loose photos never become boards or Inbox work", () => {
  const c = classify("GTX 1080/Galax/Capture2.JPG");
  assert.equal(c.identityKey, null);
  assert.equal(c.reviewReason, null);
});

test("retro names with an MS prefix read the same as those without", () => {
  for (const name of ["MS-8907-00B.pdf", "ms_8907_00B.pdf", "8907-00B.pdf"]) {
    const c = classify(`Retro/MSI Early graphics/${name}`);
    assert.equal(c.boardCode, "MS-8907", name);
    assert.equal(c.reviewReason, null, name);
  }
});

test("a retro file joins the main board when the code is known", () => {
  const [main, retro] = scan("MSI/MSI V237 HD 6970 rev 1.0.pdf", "Retro/MSI Early graphics/V237-1.0.pdf");
  assert.equal(retro.c.gpuModel, "HD 6970");
  assert.equal(retro.c.gpuMaker, "AMD");
  assert.equal(retro.c.identityKey, main.c.identityKey);
});

test("the nearest folder supplies a revision the file lacks", () => {
  assert.equal(classify("x/GV-RX580GAMING-8GD r1.0/board.pdf").revision, "1.0");
  assert.equal(classify("Rev 2.0/x/y/ASUS CG142S.pdf").revision, null);
});

test("retro revisions line up with the main library", () => {
  assert.equal(classify("Retro/MSI Early graphics/V293-30.pdf").revision, "3.0");
  assert.equal(classify("Retro/MSI Early graphics/V207-5.0.pdf").revision, "5.0");
  assert.equal(classify("Retro/MSI Early graphics/8989-10A.pdf").revision, "10A");
});

test("text stuck to a retro revision is not read as the revision", () => {
  const c = classify("Retro/MSI Early graphics/V200-10PASSWORD12345.pdf");
  assert.equal(c.boardCode, "MS-V200");
  assert.equal(c.revision, null);
});

test("run-together and underscore revisions read correctly", () => {
  assert.equal(classify("x/GV-RX560GAMING OC-2GD Rev10.tvw").revision, "1.0");
  assert.equal(classify("x/Asus_HD7800_C401PI_Rev_1_00X_-_BoardView.fz").revision, "1.00X");
});
