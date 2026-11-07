"use strict";

// Talks to NexusBV. All reading of its replies lives in this file, because the
// replies are text written for AI and a NexusBV update could change them.

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BOARD_EXT = new Set([".cad", ".tvw", ".fz", ".pcb", ".bdv", ".faz", ".brd", ".asc", ".bv", ".cst"]);
const REPLY_TIMEOUT_MS = 8000;
const OPEN_TIMEOUT_MS = 20000;
const EXTRACT_TIMEOUT_MS = 120000;
const OPEN_POLL_MS = 700;
const OPEN_CHECK_TIMEOUT_MS = 2500; // NexusBV ignores requests while it starts up
const CLOSE_TIMEOUT_MS = 30000;
const CLOSE_RETRY_MS = 4000; // a window still loading a board can miss the first request

class NexusError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Only the app's own pages may drive NexusBV, because the preload runs on any page. */
function isAllowedSender(senderUrl, serverUrl) {
  try {
    return !!serverUrl && new URL(senderUrl).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

/** Accepts only existing board and PDF files, so a page cannot launch anything else. */
function openableFile(file, extensions) {
  return (
    typeof file === "string" &&
    path.win32.isAbsolute(file) &&
    extensions.has(path.win32.extname(file).toLowerCase()) &&
    fs.existsSync(file)
  );
}

/** Reads key=value pairs from a reply, for example `selected_net=FBVDDQ`. */
function parseFields(text) {
  const fields = {};
  for (const m of text.matchAll(/(\w+)=(?:"((?:[^"\\]|\\.)*)"|(\S+))/g)) {
    fields[m[1]] = m[2] !== undefined ? m[2].replace(/\\\\/g, "\\") : m[3];
  }
  return fields;
}

function readReply(text) {
  if (/failed to send command/i.test(text)) throw new NexusError("NOT_RUNNING");
  if (!/^NEXUSBV_(FINAL|STATE)/.test(text.trim())) throw new NexusError("NOT_FOUND");
  return parseFields(text);
}

const samePath = (a, b) => !!a && !!b && path.win32.normalize(a).toLowerCase() === path.win32.normalize(b).toLowerCase();

function activeBoardPath(text) {
  return text.match(/^\s*Path:\s*(.+?)\s*$/m)?.[1] ?? null;
}

const run = (file, args) =>
  new Promise((resolve) => execFile(file, args, { windowsHide: true }, (_error, stdout) => resolve(String(stdout))));

/** Windows-level view of NexusBV. taskkill without /F asks windows to close normally. */
const windowsProcesses = {
  async count() {
    const output = await run("tasklist", ["/FI", "IMAGENAME eq NexusBV.exe", "/FO", "CSV", "/NH"]);
    return (output.match(/"NexusBV\.exe"/gi) ?? []).length;
  },
  closeAll: () => run("taskkill", ["/IM", "NexusBV.exe"]),
};

function createNexusBV({ getDir, spawnProcess = spawn, processes = windowsProcesses }) {
  let child = null;
  let nextId = 100;
  let ready = null;
  const pending = new Map();

  function settle(id, finish) {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(id);
    finish(entry);
  }

  function drop(code) {
    child = null;
    ready = null;
    for (const id of [...pending.keys()]) settle(id, (entry) => entry.reject(new NexusError(code)));
  }

  function send(message) {
    child.stdin.write(JSON.stringify(message) + "\n");
  }

  function request(method, params, timeoutMs = REPLY_TIMEOUT_MS) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        settle(id, (entry) => entry.reject(new NexusError("TIMEOUT")));
        stop(); // a stuck helper is restarted by the next call
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      send({ jsonrpc: "2.0", id, method, params });
    });
  }

  function start() {
    if (ready) return ready;
    const exe = path.join(getDir(), "nexusbv_mcp.exe");
    if (!fs.existsSync(exe)) return Promise.reject(new NexusError("NOT_INSTALLED"));

    const started = spawnProcess(exe, [], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    child = started;
    let buffer = "";
    started.stdout.on("data", (data) => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        settle(message.id, (entry) => entry.resolve(message));
      }
    });
    started.on("error", () => child === started && drop("NOT_INSTALLED"));
    started.on("exit", () => child === started && drop("NOT_RUNNING"));

    ready = request("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "gpu-fix-shop", version: "1.0" },
    }).then(() => send({ jsonrpc: "2.0", method: "notifications/initialized" }));
    ready.catch(() => {});
    return ready;
  }

  async function callText(name, args = {}, timeoutMs) {
    await start();
    const reply = await request("tools/call", { name, arguments: args }, timeoutMs);
    if (reply.error) throw new NexusError("NOT_FOUND");
    return (reply.result?.content ?? []).map((part) => part.text ?? "").join(" ");
  }

  async function waitForBoard(file) {
    const deadline = Date.now() + OPEN_TIMEOUT_MS;
    let last = "";
    while (Date.now() < deadline) {
      try {
        last = await callText("get_board_state", {}, OPEN_CHECK_TIMEOUT_MS);
        if (samePath(activeBoardPath(last), file)) return last;
      } catch (error) {
        // NexusBV is still starting, so keep asking until the deadline.
        if (error.code === "NOT_INSTALLED") throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, OPEN_POLL_MS));
    }
    throw new NexusError("TIMEOUT");
  }

  /** True when the wanted files are already the ones open, so nothing needs launching. */
  async function alreadyOpen(board, pdf) {
    if (!board) return false;
    try {
      const state = await callText("get_board_state");
      if (!samePath(activeBoardPath(state), board)) return false;
      return !pdf || samePath(parseFields(state).attached_pdf_path, pdf);
    } catch {
      return false;
    }
  }

  /**
   * Every launch starts a new NexusBV process, but commands reach only one of
   * them, so a second window would leave jumps landing on the wrong board.
   * Normal closing lets NexusBV stop for unsaved work instead of losing it.
   */
  async function closeExisting() {
    stop(); // NexusBV is slow to exit while the helper is connected
    await processes.closeAll();
    const started = Date.now();
    let retried = false;
    while ((await processes.count()) > 0) {
      const elapsed = Date.now() - started;
      if (elapsed > CLOSE_TIMEOUT_MS) throw new NexusError("STILL_OPEN");
      if (!retried && elapsed > CLOSE_RETRY_MS) {
        retried = true;
        await processes.closeAll();
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  /** Opening a board and its PDF in one launch makes NexusBV pair them. */
  async function open({ board, pdf }) {
    const hasBoard = board != null;
    const hasPdf = pdf != null;
    if ((!hasBoard && !hasPdf) || (hasBoard && !openableFile(board, BOARD_EXT)) || (hasPdf && !openableFile(pdf, new Set([".pdf"])))) {
      throw new NexusError("BAD_FILE");
    }
    const dir = getDir();
    const exe = path.join(dir, "NexusBV.exe");
    if (!fs.existsSync(exe)) throw new NexusError("NOT_INSTALLED");

    const running = await processes.count();
    if (running === 1 && (await alreadyOpen(board, pdf))) return { opened: true, paired: hasPdf };
    if (running > 0) await closeExisting();

    const app = spawnProcess(exe, [board, pdf].filter(Boolean), { detached: true, stdio: "ignore", cwd: dir });
    app.on("error", () => {});
    app.unref();

    if (!hasBoard) return { opened: true, paired: false }; // a lone PDF has no board to confirm
    const state = await waitForBoard(board);
    const { attached_pdf_path: attached } = parseFields(state);
    return { opened: true, paired: hasPdf && samePath(attached, pdf) };
  }

  const selectNet = (net) => callText("select_net", { net }).then(readReply);
  const selectComponent = (refdes) => callText("select_component", { refdes }).then(readReply);
  const selectPin = (refdes, pin) => callText("select_pin", { refdes, pin }).then(readReply);
  const getState = () =>
    callText("get_board_state").then((text) => ({ ...readReply(text), board: activeBoardPath(text) }));

  /** Reads a PDF's text by file path, without changing what NexusBV shows. */
  async function extractText(pdf, outputPath) {
    fs.rmSync(outputPath, { force: true });
    const text = await callText(
      "extract_pdfium_text",
      { pdf_path: pdf, output_path: outputPath, include_text: true, include_words: false },
      EXTRACT_TIMEOUT_MS
    );
    if (/failed to send command/i.test(text)) throw new NexusError("NOT_RUNNING");
    if (!fs.existsSync(outputPath)) throw new NexusError("NOT_FOUND");
    return JSON.parse(fs.readFileSync(outputPath, "utf8"));
  }

  function stop() {
    const running = child;
    drop("NOT_RUNNING");
    running?.kill();
  }

  return { open, selectNet, selectComponent, selectPin, getState, extractText, stop };
}

module.exports = { NexusError, createNexusBV, isAllowedSender, openableFile, parseFields, readReply, activeBoardPath };
