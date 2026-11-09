const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { activeBoardPath, createNexusBV, isAllowedSender, openableFile, parseCatalog, parseFields, readReply } = require("./nexusbv");

test("only the configured app address may drive NexusBV", () => {
  assert.ok(isAllowedSender("http://shop-server:3000/dashboard/library/1", "http://shop-server:3000"));
  assert.ok(!isAllowedSender("http://evil.example/shop-server:3000", "http://shop-server:3000"));
  assert.ok(!isAllowedSender("http://shop-server:4000/", "http://shop-server:3000"));
  assert.ok(!isAllowedSender("file:///C:/app/setup.html", "http://shop-server:3000"));
  assert.ok(!isAllowedSender("http://shop-server:3000/", null));
  assert.ok(!isAllowedSender("not a url", "http://shop-server:3000"));
});

test("only existing files of the right type can be opened", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const pdf = path.join(dir, "board.pdf");
  const exe = path.join(dir, "tool.exe");
  fs.writeFileSync(pdf, "x");
  fs.writeFileSync(exe, "x");
  const pdfOnly = new Set([".pdf"]);
  assert.ok(openableFile(pdf, pdfOnly));
  assert.ok(!openableFile(exe, pdfOnly));
  assert.ok(!openableFile(path.join(dir, "missing.pdf"), pdfOnly));
  assert.ok(!openableFile("relative.pdf", pdfOnly));
  assert.ok(!openableFile(42, pdfOnly));
  fs.rmSync(dir, { recursive: true });
});

test("replies are read into fields", () => {
  const state = 'NEXUSBV_STATE attached_pdf=true attached_pdf_path="D:\\\\Boards\\\\a b.pdf" selected_net=GND\nActive board: a.cad\nPath: D:\\Boards\\a.cad\n';
  assert.equal(parseFields(state).attached_pdf_path, "D:\\Boards\\a b.pdf");
  assert.equal(parseFields(state).selected_net, "GND");
  assert.equal(activeBoardPath(state), "D:\\Boards\\a.cad");
  assert.equal(readReply("NEXUSBV_FINAL selected_net=FBVDDQ status=complete").selected_net, "FBVDDQ");
});

test("failures become clear codes", () => {
  assert.throws(() => readReply("Failed to send command to NexusBV."), { code: "NOT_RUNNING" });
  assert.throws(() => readReply("Net not found: XYZ"), { code: "NOT_FOUND" });
});

const noWindows = { count: async () => 0, closeAll: async () => {} };

/** Stands in for the two NexusBV programs and records how they were started. */
function fakeNexus(dir, replyText) {
  fs.writeFileSync(path.join(dir, "nexusbv_mcp.exe"), "");
  fs.writeFileSync(path.join(dir, "NexusBV.exe"), "");
  const launches = [];
  let helpers = 0;
  const spawnProcess = (exe, args) => {
    launches.push({ name: path.basename(exe), args });
    const proc = new EventEmitter();
    proc.unref = () => {};
    proc.kill = () => proc.emit("exit");
    if (path.basename(exe) === "nexusbv_mcp.exe") {
      helpers++;
      proc.stdout = new EventEmitter();
      proc.stdin = {
        write(line) {
          const message = JSON.parse(line);
          if (message.id === undefined) return;
          const reply = message.method === "initialize" ? null : replyText(message);
          const result = reply === null ? {} : { content: typeof reply === "string" ? [{ type: "text", text: reply }] : reply };
          setImmediate(() => proc.stdout.emit("data", JSON.stringify({ id: message.id, result }) + "\n"));
        },
      };
    }
    return proc;
  };
  return { spawnProcess, launches, helperCount: () => helpers };
}

test("Open both launches once with both files and reports the pairing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const board = path.join(dir, "a.cad");
  const pdf = path.join(dir, "a.pdf");
  fs.writeFileSync(board, "x");
  fs.writeFileSync(pdf, "x");
  const escaped = pdf.replace(/\\/g, "\\\\");
  const fake = fakeNexus(dir, () => `NEXUSBV_STATE attached_pdf_path="${escaped}"\nPath: ${board}\n`);
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes: noWindows });
  assert.deepEqual(await nexus.open({ board, pdf }), { opened: true, paired: true });
  assert.deepEqual(fake.launches.find((l) => l.name === "NexusBV.exe").args, [board, pdf]);
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

test("a refused file never launches anything", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const fake = fakeNexus(dir, () => "");
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess });
  await assert.rejects(nexus.open({ board: "C:\\Windows\\notepad.exe" }), { code: "BAD_FILE" });
  await assert.rejects(nexus.open({}), { code: "BAD_FILE" });
  assert.equal(fake.launches.length, 0);
  fs.rmSync(dir, { recursive: true });
});

test("a missing install gives a clear code", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const nexus = createNexusBV({ getDir: () => dir });
  await assert.rejects(nexus.getState(), { code: "NOT_INSTALLED" });
  fs.rmSync(dir, { recursive: true });
});

test("the helper restarts after it stops", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const fake = fakeNexus(dir, () => "NEXUSBV_FINAL selected_net=NVVDD status=complete");
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess });
  assert.equal((await nexus.selectNet("NVVDD")).selected_net, "NVVDD");
  nexus.stop();
  assert.equal((await nexus.selectNet("NVVDD")).selected_net, "NVVDD");
  assert.equal(fake.helperCount(), 2);
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

function twoFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const board = path.join(dir, "a.cad");
  const pdf = path.join(dir, "a.pdf");
  const other = path.join(dir, "b.cad");
  for (const file of [board, pdf, other]) fs.writeFileSync(file, "x");
  return { dir, board, pdf, other };
}
const stateFor = (board, pdf) => `NEXUSBV_STATE attached_pdf_path="${pdf.replace(/\\/g, "\\\\")}"\nPath: ${board}\n`;
const launched = (fake) => fake.launches.filter((l) => l.name === "NexusBV.exe").length;

test("a board that is already open is not launched again", async () => {
  const { dir, board, pdf } = twoFiles();
  const fake = fakeNexus(dir, () => stateFor(board, pdf));
  let closed = 0;
  const processes = { count: async () => 1, closeAll: async () => closed++ };
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes });
  assert.deepEqual(await nexus.open({ board, pdf }), { opened: true, paired: true });
  assert.equal(launched(fake), 0);
  assert.equal(closed, 0);
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

test("a different board replaces the open window, so only one exists", async () => {
  const { dir, board, pdf, other } = twoFiles();
  let active = board;
  const fake = fakeNexus(dir, () => stateFor(active, pdf));
  let windows = 1;
  const processes = {
    count: async () => windows,
    closeAll: async () => {
      windows = 0;
      active = other;
    },
  };
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes });
  assert.equal((await nexus.open({ board: other })).opened, true);
  assert.equal(launched(fake), 1);
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

test("a window that refuses to close stops the open", { timeout: 40000 }, async () => {
  const { dir, board, pdf, other } = twoFiles();
  const fake = fakeNexus(dir, () => stateFor(board, pdf));
  const processes = { count: async () => 1, closeAll: async () => {} };
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes });
  await assert.rejects(nexus.open({ board: other }), { code: "STILL_OPEN" });
  assert.equal(launched(fake), 0);
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

test("PDF text comes back from the file NexusBV writes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const output = path.join(dir, "text.json");
  const fake = fakeNexus(dir, () => {
    fs.writeFileSync(output, JSON.stringify({ pages: [{ text: "GDDR6" }] }));
    return "saved";
  });
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes: noWindows });
  assert.deepEqual(await nexus.extractText("D:\\a.pdf", output), { pages: [{ text: "GDDR6" }] });
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

test("a closed NexusBV stops PDF reading with a clear code", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  const fake = fakeNexus(dir, () => "Failed to send command to NexusBV.");
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes: noWindows });
  await assert.rejects(nexus.extractText("D:\\a.pdf", path.join(dir, "text.json")), { code: "NOT_RUNNING" });
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});

test("a parts page is read into parts and nets", () => {
  const page = [
    "NEXUSBV_COMPONENT_CATALOG offset=0 limit=2 returned=2 total_matches=3413 total_components=3413 query=\"\"",
    'selected_refdes=U2000 selected_info="GDDR6 BGA180" side=T pins=180 nets=[FBVDDQ, FBA_D0, GND] pins=[1,2,3]',
    'selected_refdes=TP1 selected_info="1 TESTPAD" side=T pins=1 nets=[] pins=[1]',
    "More components available: call list_components with offset=2",
  ].join("\n");
  const { parts, more } = parseCatalog(page);
  assert.equal(more, true);
  assert.deepEqual(parts[0], { refdes: "U2000", info: "GDDR6 BGA180", nets: ["FBVDDQ", "FBA_D0", "GND"] });
  assert.deepEqual(parts[1].nets, []);
  assert.equal(parseCatalog("NEXUSBV_COMPONENT_CATALOG returned=0").more, false);
});

test("a rendered page comes back as image data, and a text reply is refused", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nexusbv-"));
  let mode = "image";
  const fake = fakeNexus(dir, () =>
    mode === "image" ? [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }] : "Failed to send command to NexusBV."
  );
  const nexus = createNexusBV({ getDir: () => dir, spawnProcess: fake.spawnProcess, processes: noWindows });
  assert.deepEqual(await nexus.renderPage("D:\\a.pdf", 1), { data: "aGVsbG8=", mimeType: "image/png" });
  mode = "closed";
  await assert.rejects(nexus.renderPage("D:\\a.pdf", 1), { code: "NOT_RUNNING" });
  nexus.stop();
  fs.rmSync(dir, { recursive: true });
});
