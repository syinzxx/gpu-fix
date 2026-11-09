import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { backupName, backupNow, databaseFile, isDue, listBackups } from "./backup";

type Db = { exec: (s: string) => void; prepare: (s: string) => { get: () => Record<string, unknown> | undefined }; close: () => void };
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as unknown as { DatabaseSync: new (f: string) => Db };

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-"));
  const source = path.join(dir, "shop.db");
  const db = new DatabaseSync(source);
  db.exec("CREATE TABLE Ticket (code TEXT); INSERT INTO Ticket VALUES ('GPU-1'), ('GPU-2');");
  db.close();
  const uploads = path.join(dir, "uploads");
  fs.mkdirSync(path.join(uploads, "tickets", "a"), { recursive: true });
  fs.writeFileSync(path.join(uploads, "tickets", "a", "photo.jpg"), "jpg");
  return { dir, source, uploads, main: path.join(dir, "main"), mirror: path.join(dir, "mirror") };
}

test("a backup is a readable copy in every folder, with the photos", () => {
  const t = setup();
  const result = backupNow({ source: t.source, dirs: [t.main, t.mirror], keep: 5, now: new Date(2026, 10, 8, 9, 5), uploads: t.uploads });
  assert.equal(result.name, "shop-2026-11-08-0905.db");
  assert.deepEqual(result.copies.map((c) => c.ok), [true, true]);
  for (const dir of [t.main, t.mirror]) {
    const copy: Db = new DatabaseSync(path.join(dir, result.name));
    assert.equal(copy.prepare("SELECT count(*) AS n FROM Ticket").get()?.n, 2);
    copy.close();
    assert.ok(fs.existsSync(path.join(dir, "uploads", "tickets", "a", "photo.jpg")));
  }
  assert.ok(!fs.readdirSync(t.main).some((f) => f.endsWith(".partial")));
  fs.rmSync(t.dir, { recursive: true, force: true });
});

test("only the newest copies are kept", () => {
  const t = setup();
  for (let day = 1; day <= 5; day++) backupNow({ source: t.source, dirs: [t.main], keep: 3, now: new Date(2026, 10, day, 8, 0) });
  assert.deepEqual(listBackups([t.main]).map((b) => b.name), [
    "shop-2026-11-05-0800.db",
    "shop-2026-11-04-0800.db",
    "shop-2026-11-03-0800.db",
  ]);
  fs.rmSync(t.dir, { recursive: true, force: true });
});

test("a missing mirror drive is reported but the main copy still happens", () => {
  const t = setup();
  const blocked = path.join(t.dir, "not-a-folder");
  fs.writeFileSync(blocked, "a file where a folder should be");
  const result = backupNow({ source: t.source, dirs: [t.main, blocked], keep: 5 });
  assert.equal(result.copies[0].ok, true);
  assert.equal(result.copies[1].ok, false);
  assert.ok(result.copies[1].error);
  fs.rmSync(t.dir, { recursive: true, force: true });
});

test("a missing database stops with a clear message", () => {
  const t = setup();
  assert.throws(() => backupNow({ source: path.join(t.dir, "nope.db"), dirs: [t.main], keep: 5 }), /not found/);
  fs.rmSync(t.dir, { recursive: true, force: true });
});

test("a backup is due when none exists or the newest is too old", () => {
  const t = setup();
  assert.equal(isDue([t.main], 20), true);
  backupNow({ source: t.source, dirs: [t.main], keep: 5 });
  assert.equal(isDue([t.main], 20), false);
  assert.equal(isDue([t.main], 20, new Date(Date.now() + 21 * 3600_000)), true);
  fs.rmSync(t.dir, { recursive: true, force: true });
});

test("the database path follows Prisma's rules", () => {
  assert.equal(databaseFile("file:./dev.db", "C:\\app"), path.resolve("C:\\app", "prisma", "dev.db"));
  assert.equal(databaseFile("file:D:/data/shop.db", "C:\\app"), "D:/data/shop.db");
  assert.equal(backupName(new Date(2026, 0, 2, 3, 4)), "shop-2026-01-02-0304.db");
});
