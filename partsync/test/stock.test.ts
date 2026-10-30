import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import Database from "better-sqlite3";
import { openDatabase } from "../lib/db";
import { composeMessage } from "../lib/compose";
import {
  checkOutBom,
  createBom,
  createItem,
  deleteItem,
  fileTestMessage,
  getBom,
  getItem,
  getMessage,
  listBoms,
  listMovements,
  lowItems,
  markMessage,
  moveStock,
  queueDigest,
  updateItem,
  boardData,
} from "../lib/inventory";
import { itemLetter } from "../lib/letters";
import { parseAmount } from "../lib/parse";
import { readSettings, sendBlocker, writeSettings } from "../lib/settings";
import { formatQty, roundQty } from "../lib/stock-rules";
import { zonedDayStart } from "../lib/time";

const envKeys = [
  "PARTSYNC_SITE_NAME",
  "PARTSYNC_TIME_ZONE",
  "PARTSYNC_NOTIFY_EMAIL",
  "PARTSYNC_SMTP_HOST",
  "PARTSYNC_SMTP_PORT",
  "PARTSYNC_SMTP_SECURE",
  "PARTSYNC_SMTP_USER",
  "PARTSYNC_SMTP_PASS",
  "PARTSYNC_SMTP_FROM",
  "PARTSYNC_PUBLIC_URL",
];

const savedEnv = new Map<string, string | undefined>();

function rememberEnv() {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
}

function restoreEnv() {
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function tempDb(): Database.Database {
  return openDatabase(":memory:");
}

rememberEnv();
afterEach(() => {
  restoreEnv();
});

describe("quantities and the clock", () => {
  it("rounds to three decimal places and formats for the UK", () => {
    assert.equal(roundQty(0.3 - 0.1), 0.2);
    assert.equal(formatQty(1200.5), "1,200.5");
    assert.equal(parseAmount("1,5"), 1.5);
  });

  it("finds local midnight in London winter and summer", () => {
    const winter = zonedDayStart("Europe/London", new Date("2026-10-29T12:00:00.000Z"));
    assert.equal(winter.toISOString(), "2026-10-29T00:00:00.000Z");
    const summer = zonedDayStart("Europe/London", new Date("2026-07-15T23:30:00.000Z"));
    assert.equal(summer.toISOString(), "2026-07-15T23:00:00.000Z");
  });
});

describe("stock and reorder mail", () => {
  it("emails once when stock crosses the line, then again only after a restock", () => {
    const db = tempDb();
    const created = createItem(db, {
      name: "A4 paper",
      sku: "PAPER-A4",
      category: "Stationery",
      unit: "reams",
      quantity: 6,
      lowStockAt: 5,
      supplier: "Viking",
      notes: "",
    });
    assert.equal(created.notice, null);

    const first = moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 2,
      person: "Sam",
      note: "print run",
      now: "2026-10-29T12:00:00.000Z",
    });
    assert.equal(first.item.quantity, 4);
    assert.ok(first.notice);
    assert.equal(getMessage(db, first.notice.messageId)?.status, "held");

    const second = moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 1,
      person: "Sam",
      note: "",
    });
    assert.equal(second.notice, null);
    assert.equal(second.item.quantity, 3);

    const restock = moveStock(db, {
      itemId: created.item.id,
      kind: "in",
      amount: 4,
      person: "Jo",
      note: "delivery",
    });
    assert.equal(restock.item.quantity, 7);
    assert.equal(restock.item.alertActive, false);
    assert.equal(getMessage(db, first.notice.messageId)?.status, "cancelled");

    const again = moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 3,
      person: "Sam",
      note: "",
    });
    assert.equal(again.item.quantity, 4);
    assert.ok(again.notice);
    assert.notEqual(again.notice.messageId, first.notice.messageId);
    db.close();
  });

  it("refuses to take more than is in stock and leaves the count alone", () => {
    const db = tempDb();
    const created = createItem(db, {
      name: "Gloves",
      sku: "",
      category: "",
      unit: "boxes",
      quantity: 2,
      lowStockAt: 1,
      supplier: "",
      notes: "",
    });
    assert.throws(
      () =>
        moveStock(db, {
          itemId: created.item.id,
          kind: "out",
          amount: 3,
          person: "Sam",
          note: "",
        }),
      /more than the 2 boxes/,
    );
    assert.equal(getItem(db, created.item.id)?.quantity, 2);
    assert.throws(
      () =>
        moveStock(db, {
          itemId: created.item.id,
          kind: "out",
          amount: 1,
          person: "  ",
          note: "",
        }),
      /name on the ledger/,
    );
    db.close();
  });

  it("notifies when a new item is already low, and when the reorder line is lowered onto the count", () => {
    const db = tempDb();
    const created = createItem(db, {
      name: "Coffee beans",
      sku: "",
      category: "Kitchen",
      unit: "g",
      quantity: 350,
      lowStockAt: 500,
      supplier: "Origin",
      notes: "The tin",
    });
    assert.ok(created.notice);
    assert.equal(created.item.alertActive, true);

    const raised = updateItem(db, created.item.id, {
      ...created.item,
      lowStockAt: 100,
    });
    assert.equal(raised.notice, null);
    assert.equal(raised.item.alertActive, false);

    const lowered = updateItem(db, created.item.id, {
      ...created.item,
      lowStockAt: 400,
    });
    assert.ok(lowered.notice);
    assert.equal(lowItems(db).map((item) => item.name).includes("Coffee beans"), true);
    db.close();
  });

  it("keeps ledger lines after an item is removed", () => {
    const db = tempDb();
    const created = createItem(db, {
      name: "Blue roll",
      sku: "",
      category: "",
      unit: "rolls",
      quantity: 4,
      lowStockAt: null,
      supplier: "",
      notes: "",
    });
    moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 1,
      person: "Sam",
      note: "workshop",
    });
    deleteItem(db, created.item.id);
    const lines = listMovements(db);
    assert.equal(getItem(db, created.item.id), null);
    assert.equal(lines.some((line) => line.itemName === "Blue roll" && line.itemId === null), true);
    db.close();
  });

  it("counts take-outs since local midnight", () => {
    const db = tempDb();
    const created = createItem(db, {
      name: "Milk",
      sku: "",
      category: "",
      unit: "litres",
      quantity: 4,
      lowStockAt: null,
      supplier: "",
      notes: "",
    });
    moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 1,
      person: "Sam",
      note: "",
      now: "2026-07-15T22:30:00.000Z",
    });
    moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 1,
      person: "Sam",
      note: "",
      now: "2026-07-15T23:30:00.000Z",
    });
    const beforeMidnight = boardData(db, "Europe/London", new Date("2026-07-15T22:30:00.000Z"));
    const afterMidnight = boardData(db, "Europe/London", new Date("2026-07-15T23:30:00.000Z"));
    assert.equal(beforeMidnight.takenToday, 1);
    assert.equal(afterMidnight.takenToday, 1);
    db.close();
  });
});

describe("letters and setup", () => {
  it("writes an order email that names the item, the count, and the others", () => {
    const letter = itemLetter({
      siteName: "Workshop stores",
      item: {
        name: "Nitrile gloves (M)",
        sku: "GLV-M",
        unit: "boxes",
        supplier: "Medisupply",
        category: "Workshop",
        quantity: 2,
        lowStockAt: 4,
        notes: "Powder-free.",
      },
      movement: {
        kind: "out",
        amount: 1,
        newQuantity: 2,
        unit: "boxes",
        person: "Sam",
        note: "van",
        when: "29 Oct 2026, 12:00",
      },
      others: [
        {
          name: "Coffee beans",
          sku: "",
          unit: "g",
          supplier: "",
          category: "",
          quantity: 350,
          lowStockAt: 500,
          notes: "",
        },
      ],
      link: "http://192.168.1.20:4747/reorder",
    });
    assert.match(letter.subject, /Nitrile gloves \(M\)/);
    assert.match(letter.subject, /needs ordering/);
    assert.match(letter.text, /2 boxes/);
    assert.match(letter.text, /Medisupply/);
    assert.match(letter.text, /Coffee beans/);
    assert.match(letter.text, /192\.168\.1\.20:4747\/reorder/);
  });

  it("composes a held item message from the live count", () => {
    const db = tempDb();
    const created = createItem(db, {
      name: "Plasters",
      sku: "AID",
      category: "First aid",
      unit: "boxes",
      quantity: 1,
      lowStockAt: 2,
      supplier: "Medisupply",
      notes: "",
    });
    assert.ok(created.notice);
    const settings = readSettings(db).values;
    const letter = composeMessage(db, created.notice.messageId, {
      ...settings,
      siteName: "PartSync",
      publicUrl: "http://10.0.0.8:4747",
    });
    assert.ok(letter);
    assert.match(letter.text, /Plasters/);
    assert.match(letter.text, /http:\/\/10\.0\.0\.8:4747\/reorder/);
    db.close();
  });

  it("lets the environment override an address, and keeps a saved password when the field is blank", () => {
    const db = tempDb();
    writeSettings(db, {
      siteName: "Workshop stores",
      timeZone: "Europe/London",
      notifyEmails: "stores@example.com",
      smtpHost: "smtp.example.com",
      smtpPort: "587",
      smtpSecure: "starttls",
      smtpUser: "stores@example.com",
      smtpPass: "secret-pass",
      smtpFrom: "stores@example.com",
      publicUrl: "http://192.168.1.20:4747",
    });
    process.env.PARTSYNC_NOTIFY_EMAIL = "boss@example.com";
    const read = readSettings(db);
    assert.equal(read.values.notifyEmails, "boss@example.com");
    assert.equal(read.locked.notifyEmails, true);
    assert.equal(read.values.smtpPass, "secret-pass");
    delete process.env.PARTSYNC_NOTIFY_EMAIL;
    writeSettings(db, {
      siteName: "Workshop stores",
      timeZone: "Europe/London",
      notifyEmails: "stores@example.com",
      smtpHost: "smtp.example.com",
      smtpPort: "587",
      smtpSecure: "starttls",
      smtpUser: "stores@example.com",
      smtpPass: "",
      smtpFrom: "stores@example.com",
      publicUrl: "",
    });
    assert.equal(readSettings(db).values.smtpPass, "secret-pass");
    assert.equal(sendBlocker(readSettings(db).values), null);
    db.close();
  });

  it("records a sent test without wiping the subject on a later update", () => {
    const db = tempDb();
    const notice = fileTestMessage(db);
    markMessage(db, notice.messageId, {
      status: "sent",
      detail: "",
      subject: "PartSync test",
      body: "Hello",
      sentAt: "2026-10-29T12:00:00.000Z",
    });
    markMessage(db, notice.messageId, { status: "sent", detail: "again" });
    const message = getMessage(db, notice.messageId);
    assert.equal(message?.subject, "PartSync test");
    assert.equal(message?.body, "Hello");
    assert.equal(message?.sentAt, "2026-10-29T12:00:00.000Z");
    assert.equal(message?.detail, "again");
    db.close();
  });

  it("refuses a digest when nothing is low", () => {
    const db = tempDb();
    createItem(db, {
      name: "Cable ties",
      sku: "",
      category: "",
      unit: "bags",
      quantity: 6,
      lowStockAt: 2,
      supplier: "",
      notes: "",
    });
    assert.throws(() => queueDigest(db), /Nothing is on or below/);
    db.close();
  });

  it("takes a bill of materials out together, or not at all", () => {
    const db = tempDb();
    const seal = createItem(db, {
      name: "Pump seal",
      sku: "SEAL",
      category: "",
      unit: "each",
      quantity: 1,
      lowStockAt: null,
      supplier: "",
      notes: "",
    });
    const bolt = createItem(db, {
      name: "Bolt",
      sku: "M6",
      category: "",
      unit: "each",
      quantity: 10,
      lowStockAt: 8,
      supplier: "",
      notes: "",
    });
    const bom = createBom(db, {
      name: "Pump kit",
      notes: "service",
      lines: [
        { itemId: seal.item.id, quantity: 1 },
        { itemId: seal.item.id, quantity: 1 },
        { itemId: bolt.item.id, quantity: 4 },
      ],
    });
    assert.equal(bom.lines.length, 2);
    assert.equal(bom.lines.find((line) => line.itemId === seal.item.id)?.quantity, 2);
    assert.equal(listBoms(db)[0]?.short, true);
    assert.throws(
      () => checkOutBom(db, { bomId: bom.id, person: "Sam", note: "job 12" }),
      /has to leave together/,
    );
    assert.equal(getItem(db, seal.item.id)?.quantity, 1);
    assert.equal(getItem(db, bolt.item.id)?.quantity, 10);
    assert.equal(listMovements(db).length, 0);

    moveStock(db, {
      itemId: seal.item.id,
      kind: "in",
      amount: 4,
      person: "Sam",
      note: "",
    });
    const outcome = checkOutBom(db, { bomId: bom.id, person: "Sam", note: "job 12" });
    assert.equal(getItem(db, seal.item.id)?.quantity, 3);
    assert.equal(getItem(db, bolt.item.id)?.quantity, 6);
    assert.equal(outcome.movements.length, 2);
    assert.equal(outcome.notices.length, 1);
    assert.equal(new Set(outcome.movements.map((line) => line.batchId)).size, 1);
    assert.equal(
      outcome.movements.every((line) => line.batchName === "Pump kit" && line.person === "Sam"),
      true,
    );
    assert.equal(listMovements(db, { query: "Pump kit" }).length, 2);
    assert.equal(listBoms(db)[0]?.short, false);

    deleteItem(db, bolt.item.id);
    assert.equal(getBom(db, bom.id)?.lines.length, 1);
    db.close();
  });
});

describe("older databases", () => {
  it("adds group columns to a ledger that already exists", () => {
    const file = path.join(os.tmpdir(), `partsync-${crypto.randomUUID()}.db`);
    const legacy = new Database(file);
    legacy.exec(`CREATE TABLE movements (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      item_name TEXT NOT NULL,
      item_unit TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount REAL NOT NULL,
      previous_quantity REAL NOT NULL,
      new_quantity REAL NOT NULL,
      person TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`);
    legacy.close();
    const db = openDatabase(file);
    const names = new Set(
      (db.prepare("PRAGMA table_info(movements)").all() as { name: string }[]).map(
        (column) => column.name,
      ),
    );
    assert.equal(names.has("batch_id"), true);
    assert.equal(names.has("batch_name"), true);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'boms'").get());
    const created = createItem(db, {
      name: "Gasket",
      sku: "",
      category: "",
      unit: "each",
      quantity: 3,
      lowStockAt: null,
      supplier: "",
      notes: "",
    });
    moveStock(db, {
      itemId: created.item.id,
      kind: "out",
      amount: 1,
      person: "Sam",
      note: "",
    });
    const line = listMovements(db)[0];
    assert.equal(line?.batchId, null);
    assert.equal(line?.batchName, "");
    db.close();
    fs.rmSync(file, { force: true });
    fs.rmSync(`${file}-wal`, { force: true });
    fs.rmSync(`${file}-shm`, { force: true });
  });
});
