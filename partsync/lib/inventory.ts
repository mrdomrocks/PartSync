import type { Database } from "better-sqlite3";
import { StockError } from "@/lib/errors";
import { formatQty, isLow, roundQty } from "@/lib/stock-rules";
import { zonedDayStart } from "@/lib/time";
import type {
  Bom,
  BomLine,
  BomLineInput,
  BomSummary,
  ItemDraft,
  MessageKind,
  MessageRecord,
  MessageStatus,
  MovementKind,
  MovementRecord,
  Notice,
  ShelfItem,
} from "@/lib/types";

const UNIT_HINTS = [
  "each",
  "box",
  "boxes",
  "pack",
  "packs",
  "reams",
  "rolls",
  "bags",
  "kg",
  "g",
  "litres",
  "bottles",
  "tubs",
];

type ItemRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  quantity: number;
  lowStockAt: number | null;
  supplier: string;
  notes: string;
  alertActive: number;
  createdAt: string;
  updatedAt: string;
  lastOutAt: string | null;
};

const ITEM_SELECT = `
  SELECT
    i.id,
    i.name,
    i.sku,
    i.category,
    i.unit,
    i.quantity,
    i.low_stock_at AS lowStockAt,
    i.supplier,
    i.notes,
    i.alert_active AS alertActive,
    i.created_at AS createdAt,
    i.updated_at AS updatedAt,
    (
      SELECT m.created_at FROM movements m
      WHERE m.item_id = i.id AND m.kind = 'out'
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS lastOutAt
  FROM items i
`;

function mapItem(row: ItemRow): ShelfItem {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    quantity: row.quantity,
    lowStockAt: row.lowStockAt,
    supplier: row.supplier,
    notes: row.notes,
    alertActive: row.alertActive === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastOutAt: row.lastOutAt,
  };
}

function requireText(value: string, max: number, empty: string, tooLong: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new StockError(empty);
  if (trimmed.length > max) throw new StockError(tooLong);
  return trimmed;
}

function optionalText(value: string, max: number, tooLong: string): string {
  const trimmed = value.trim();
  if (trimmed.length > max) throw new StockError(tooLong);
  return trimmed;
}

function cleanDraft(draft: ItemDraft): ItemDraft {
  const lowStockAt =
    draft.lowStockAt == null ? null : roundQty(draft.lowStockAt);
  if (lowStockAt != null && lowStockAt < 0) {
    throw new StockError("The reorder line can't be below zero.");
  }
  return {
    name: requireText(draft.name, 120, "Give the item a name.", "That name is too long."),
    sku: optionalText(draft.sku, 60, "The SKU is too long."),
    category: optionalText(draft.category, 60, "That place name is too long."),
    unit:
      optionalText(draft.unit, 30, "Keep the unit short, like ream, box, or kg.") ||
      "each",
    lowStockAt,
    supplier: optionalText(draft.supplier, 120, "That supplier name is too long."),
    notes: optionalText(draft.notes, 500, "That note is too long."),
  };
}

export function getItem(db: Database, id: string): ShelfItem | null {
  const row = db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).get(id) as ItemRow | undefined;
  return row ? mapItem(row) : null;
}

export function listItems(db: Database): ShelfItem[] {
  const rows = db
    .prepare(`${ITEM_SELECT} ORDER BY i.name COLLATE NOCASE, i.id`)
    .all() as ItemRow[];
  return rows.map(mapItem);
}

export function lowItems(db: Database): ShelfItem[] {
  return listItems(db).filter((item) => isLow(item.quantity, item.lowStockAt));
}

function mapMovement(row: MovementRecord): MovementRecord {
  return row;
}

const MOVEMENT_SELECT = `
  SELECT
    id,
    item_id AS itemId,
    item_name AS itemName,
    item_unit AS itemUnit,
    kind,
    amount,
    previous_quantity AS previousQuantity,
    new_quantity AS newQuantity,
    person,
    note,
    batch_id AS batchId,
    batch_name AS batchName,
    created_at AS createdAt
  FROM movements
`;

export function getMovement(db: Database, id: string): MovementRecord | null {
  const row = db.prepare(`${MOVEMENT_SELECT} WHERE id = ?`).get(id) as
    | MovementRecord
    | undefined;
  return row ? mapMovement(row) : null;
}

function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}

export function listMovements(
  db: Database,
  filter: { itemId?: string; kind?: MovementKind | ""; query?: string; limit?: number } = {},
): MovementRecord[] {
  const kind = filter.kind ?? "";
  const query = (filter.query ?? "").trim();
  const pattern = query ? likePattern(query) : "";
  const rows = db
    .prepare(
      `${MOVEMENT_SELECT}
       WHERE (? = '' OR item_id = ?)
         AND (? = '' OR kind = ?)
         AND (
           ? = ''
           OR item_name LIKE ? ESCAPE '\\'
           OR person LIKE ? ESCAPE '\\'
           OR note LIKE ? ESCAPE '\\'
           OR batch_name LIKE ? ESCAPE '\\'
         )
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(
      filter.itemId ?? "",
      filter.itemId ?? "",
      kind,
      kind,
      query,
      pattern,
      pattern,
      pattern,
      pattern,
      filter.limit ?? 300,
    ) as MovementRecord[];
  return rows.map(mapMovement);
}

export function recentPeople(db: Database, limit = 8): string[] {
  const rows = db
    .prepare(
      `SELECT person
       FROM movements
       WHERE person != ''
       GROUP BY person
       ORDER BY MAX(created_at) DESC
       LIMIT ?`,
    )
    .all(limit) as { person: string }[];
  return rows.map((row) => row.person);
}

export function suggestions(db: Database): {
  categories: string[];
  units: string[];
  suppliers: string[];
} {
  const column = (name: string) =>
    (
      db
        .prepare(
          `SELECT DISTINCT ${name} AS value FROM items WHERE ${name} != '' ORDER BY value COLLATE NOCASE`,
        )
        .all() as { value: string }[]
    ).map((row) => row.value);
  const units = column("unit");
  for (const hint of UNIT_HINTS) {
    if (!units.some((unit) => unit.toLowerCase() === hint.toLowerCase())) {
      units.push(hint);
    }
  }
  return {
    categories: column("category"),
    units,
    suppliers: column("supplier"),
  };
}

function mapMessage(row: MessageRecord): MessageRecord {
  return row;
}

const MESSAGE_SELECT = `
  SELECT
    id,
    kind,
    item_id AS itemId,
    status,
    detail,
    subject,
    body,
    payload,
    created_at AS createdAt,
    sent_at AS sentAt
  FROM messages
`;

export function getMessage(db: Database, id: string): MessageRecord | null {
  const row = db.prepare(`${MESSAGE_SELECT} WHERE id = ?`).get(id) as
    | MessageRecord
    | undefined;
  return row ? mapMessage(row) : null;
}

export function listMessages(db: Database, limit = 20): MessageRecord[] {
  const rows = db
    .prepare(`${MESSAGE_SELECT} ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(limit) as MessageRecord[];
  return rows.map(mapMessage);
}

export function latestItemMessage(db: Database, itemId: string): MessageRecord | null {
  const row = db
    .prepare(
      `${MESSAGE_SELECT} WHERE item_id = ? AND kind = 'item' ORDER BY created_at DESC LIMIT 1`,
    )
    .get(itemId) as MessageRecord | undefined;
  return row ? mapMessage(row) : null;
}

export function pendingMessages(db: Database): MessageRecord[] {
  const rows = db
    .prepare(
      `${MESSAGE_SELECT} WHERE status IN ('held', 'failed') ORDER BY created_at ASC, id ASC`,
    )
    .all() as MessageRecord[];
  return rows.map(mapMessage);
}

export function waitingCount(db: Database): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE status IN ('held', 'failed')",
    )
    .get() as { n: number };
  return row.n;
}

export function markMessage(
  db: Database,
  id: string,
  patch: {
    status: MessageStatus;
    detail: string;
    subject?: string;
    body?: string;
    sentAt?: string | null;
  },
): void {
  db.prepare(
    `UPDATE messages
     SET status = ?,
         detail = ?,
         subject = COALESCE(?, subject),
         body = COALESCE(?, body),
         sent_at = CASE WHEN ? IS NULL THEN sent_at ELSE ? END
     WHERE id = ?`,
  ).run(
    patch.status,
    patch.detail,
    patch.subject ?? null,
    patch.body ?? null,
    patch.sentAt === undefined ? null : patch.sentAt,
    patch.sentAt === undefined ? null : patch.sentAt,
    id,
  );
}

function cancelOpenItemMail(db: Database, itemId: string, detail: string): void {
  db.prepare(
    `UPDATE messages
     SET status = 'cancelled', detail = ?
     WHERE item_id = ? AND kind = 'item' AND status IN ('held', 'failed')`,
  ).run(detail, itemId);
}

function insertMessage(
  db: Database,
  kind: MessageKind,
  itemId: string | null,
  payload: unknown,
  now: string,
): Notice {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO messages (id, kind, item_id, status, detail, subject, body, payload, created_at, sent_at)
     VALUES (?, ?, ?, 'held', '', '', '', ?, ?, NULL)`,
  ).run(id, kind, itemId, JSON.stringify(payload), now);
  return { messageId: id };
}

function insertMovement(
  db: Database,
  input: {
    item: ShelfItem;
    kind: MovementKind;
    amount: number;
    previous: number;
    next: number;
    person: string;
    note: string;
    batchId?: string | null;
    batchName?: string;
    now: string;
  },
): string {
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO movements (
      id, item_id, item_name, item_unit, kind, amount, previous_quantity, new_quantity,
      person, note, batch_id, batch_name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.item.id,
    input.item.name,
    input.item.unit,
    input.kind,
    input.amount,
    input.previous,
    input.next,
    input.person,
    input.note,
    input.batchId ?? null,
    input.batchName ?? "",
    input.now,
  );
  return id;
}

export function createItem(
  db: Database,
  draft: ItemDraft & { quantity: number },
  options: { now?: string } = {},
): { item: ShelfItem; notice: Notice | null } {
  const cleaned = cleanDraft(draft);
  const quantity = roundQty(draft.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new StockError("The opening count can't be below zero.");
  }
  const now = options.now ?? new Date().toISOString();
  const notify = isLow(quantity, cleaned.lowStockAt);
  const id = crypto.randomUUID();

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO items (
        id, name, sku, category, unit, quantity, low_stock_at, supplier, notes, alert_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      cleaned.name,
      cleaned.sku,
      cleaned.category,
      cleaned.unit,
      quantity,
      cleaned.lowStockAt,
      cleaned.supplier,
      cleaned.notes,
      notify ? 1 : 0,
      now,
      now,
    );
    const item = getItem(db, id);
    if (!item) throw new StockError("The item didn't save.");
    const movementId = insertMovement(db, {
      item,
      kind: "set",
      amount: quantity,
      previous: 0,
      next: quantity,
      person: "",
      note: "Opening count",
      now,
    });
    const notice = notify
      ? insertMessage(db, "item", id, { itemId: id, movementId }, now)
      : null;
    return { item: getItem(db, id)!, notice };
  });

  return run();
}

export function updateItem(
  db: Database,
  id: string,
  draft: ItemDraft,
  now = new Date().toISOString(),
): { item: ShelfItem; notice: Notice | null } {
  const cleaned = cleanDraft(draft);
  const run = db.transaction(() => {
    const current = getItem(db, id);
    if (!current) throw new StockError("That item is no longer on the catalogue.");
    const wasLow = isLow(current.quantity, current.lowStockAt);
    const nowLow = isLow(current.quantity, cleaned.lowStockAt);
    const crossed = !wasLow && nowLow;
    const restored = wasLow && !nowLow;
    const alertActive = crossed ? 1 : restored ? 0 : current.alertActive ? 1 : 0;
    db.prepare(
      `UPDATE items
       SET name = ?, sku = ?, category = ?, unit = ?, low_stock_at = ?, supplier = ?, notes = ?,
           alert_active = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      cleaned.name,
      cleaned.sku,
      cleaned.category,
      cleaned.unit,
      cleaned.lowStockAt,
      cleaned.supplier,
      cleaned.notes,
      alertActive,
      now,
      id,
    );
    if (restored) {
      cancelOpenItemMail(db, id, "The reorder line was raised above the count.");
    }
    const notice = crossed ? insertMessage(db, "item", id, { itemId: id }, now) : null;
    return { item: getItem(db, id)!, notice };
  });
  return run();
}

export function deleteItem(db: Database, id: string): void {
  const run = db.transaction(() => {
    const current = getItem(db, id);
    if (!current) throw new StockError("That item is already gone.");
    cancelOpenItemMail(db, id, "The item was removed from the catalogue.");
    db.prepare("DELETE FROM items WHERE id = ?").run(id);
  });
  run();
}

export function moveStock(
  db: Database,
  input: {
    itemId: string;
    kind: MovementKind;
    amount: number;
    person: string;
    note: string;
    now?: string;
    batchId?: string | null;
    batchName?: string;
  },
): { item: ShelfItem; movement: MovementRecord; notice: Notice | null } {
  const now = input.now ?? new Date().toISOString();
  const run = db.transaction(() => {
    const current = getItem(db, input.itemId);
    if (!current) throw new StockError("That item is no longer on the catalogue.");
    const amount = roundQty(input.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new StockError("Enter a quantity of zero or more.");
    }
    if (input.kind !== "set" && amount <= 0) {
      throw new StockError("Enter a quantity above zero.");
    }
    const person = optionalText(input.person, 80, "That name is too long.");
    if (input.kind === "out" && !person) {
      throw new StockError("Put your name on the ledger, so we know who took it.");
    }
    const note = optionalText(input.note, 500, "That note is too long.");
    const previous = current.quantity;
    let next = amount;
    if (input.kind === "out") {
      if (amount > previous) {
        throw new StockError(
          `That's more than the ${formatQty(previous)} ${current.unit} in stock.`,
        );
      }
      next = roundQty(previous - amount);
    } else if (input.kind === "in") {
      next = roundQty(previous + amount);
    }
    if (next < 0) throw new StockError("The count can't go below zero.");

    const wasLow = isLow(previous, current.lowStockAt);
    const nowLow = isLow(next, current.lowStockAt);
    const crossed = !wasLow && nowLow;
    const restored = wasLow && !nowLow;
    const alertActive = crossed ? 1 : restored ? 0 : current.alertActive ? 1 : 0;

    db.prepare(
      "UPDATE items SET quantity = ?, alert_active = ?, updated_at = ? WHERE id = ?",
    ).run(next, alertActive, now, current.id);

    const movementId = insertMovement(db, {
      item: current,
      kind: input.kind,
      amount,
      previous,
      next,
      person,
      note,
      batchId: input.batchId ?? null,
      batchName: input.batchName ?? "",
      now,
    });
    if (restored) {
      cancelOpenItemMail(db, current.id, "Stock went back above the reorder line.");
    }
    const notice = crossed
      ? insertMessage(db, "item", current.id, { itemId: current.id, movementId }, now)
      : null;
    const movement = getMovement(db, movementId);
    const item = getItem(db, current.id);
    if (!movement || !item) throw new StockError("The ledger line didn't save.");
    return { item, movement, notice };
  });
  return run();
}

export function queueDigest(db: Database, now = new Date().toISOString()): Notice {
  const run = db.transaction(() => {
    const low = lowItems(db);
    if (low.length === 0) {
      throw new StockError("Nothing is on or below its reorder line.");
    }
    const existing = db
      .prepare(
        `SELECT id FROM messages
         WHERE kind = 'digest' AND status IN ('held', 'failed')
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get() as { id: string } | undefined;
    db.prepare(
      `UPDATE items SET alert_active = 1, updated_at = ?
       WHERE low_stock_at IS NOT NULL AND quantity <= low_stock_at`,
    ).run(now);
    for (const item of low) {
      cancelOpenItemMail(db, item.id, "Included in the reorder list email.");
    }
    if (existing) return { messageId: existing.id };
    return insertMessage(db, "digest", null, { requestedAt: now }, now);
  });
  return run();
}

export function fileTestMessage(db: Database, now = new Date().toISOString()): Notice {
  return insertMessage(db, "test", null, {}, now);
}

export function discardMessage(db: Database, id: string): void {
  const message = getMessage(db, id);
  if (!message) throw new StockError("That message is already gone.");
  if (message.status === "sent") {
    throw new StockError("That email already went out.");
  }
  markMessage(db, id, { status: "cancelled", detail: "Discarded from the outbox." });
}

export function boardData(db: Database, timeZone: string, now = new Date()) {
  const startDate = zonedDayStart(timeZone, now);
  const nextDate = zonedDayStart(
    timeZone,
    new Date(startDate.getTime() + 36 * 60 * 60 * 1000),
  );
  const items = listItems(db);
  const low = items.filter((item) => isLow(item.quantity, item.lowStockAt));
  const taken = db
    .prepare(
      "SELECT COUNT(*) AS n FROM movements WHERE kind = 'out' AND created_at >= ? AND created_at < ?",
    )
    .get(startDate.toISOString(), nextDate.toISOString()) as { n: number };
  return {
    items,
    low,
    unguarded: items.filter((item) => item.lowStockAt == null).length,
    takenToday: taken.n,
    recent: listMovements(db, { limit: 8 }),
    waiting: waitingCount(db),
    people: recentPeople(db),
  };
}

export function messagePayload(message: MessageRecord): {
  itemId?: string;
  movementId?: string;
} {
  try {
    const parsed = JSON.parse(message.payload) as {
      itemId?: string;
      movementId?: string;
    };
    return parsed ?? {};
  } catch {
    return {};
  }
}

const BOM_SELECT = `
  SELECT id, name, notes, created_at AS createdAt, updated_at AS updatedAt
  FROM boms
`;

function bomLines(db: Database, bomId: string): BomLine[] {
  return db
    .prepare(
      `SELECT
         l.id,
         l.item_id AS itemId,
         i.name,
         i.sku,
         i.unit,
         l.quantity,
         i.quantity AS inStock
       FROM bom_lines l
       JOIN items i ON i.id = l.item_id
       WHERE l.bom_id = ?
       ORDER BY i.name COLLATE NOCASE, i.id`,
    )
    .all(bomId) as BomLine[];
}

export function getBom(db: Database, id: string): Bom | null {
  const row = db.prepare(`${BOM_SELECT} WHERE id = ?`).get(id) as
    | Omit<Bom, "lines">
    | undefined;
  if (!row) return null;
  return { ...row, lines: bomLines(db, id) };
}

export function listBoms(db: Database): BomSummary[] {
  const rows = db
    .prepare(
      `SELECT
         b.id,
         b.name,
         b.notes,
         b.updated_at AS updatedAt,
         COUNT(l.id) AS lineCount,
         SUM(CASE WHEN l.id IS NOT NULL AND i.quantity < l.quantity THEN 1 ELSE 0 END) AS shortCount
       FROM boms b
       LEFT JOIN bom_lines l ON l.bom_id = b.id
       LEFT JOIN items i ON i.id = l.item_id
       GROUP BY b.id
       ORDER BY b.name COLLATE NOCASE, b.id`,
    )
    .all() as (Omit<BomSummary, "short" | "lineCount"> & {
    lineCount: number;
    shortCount: number | null;
  })[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes,
    lineCount: row.lineCount,
    short: Number(row.shortCount ?? 0) > 0,
    updatedAt: row.updatedAt,
  }));
}

function replaceBomLines(db: Database, bomId: string, lines: BomLineInput[]) {
  const merged = new Map<string, number>();
  for (const line of lines) {
    const quantity = roundQty(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new StockError("Each line needs a quantity above zero.");
    }
    if (quantity > 1_000_000_000) throw new StockError("That quantity is too large.");
    const item = getItem(db, line.itemId);
    if (!item) throw new StockError("One of the lines is no longer on the catalogue.");
    merged.set(item.id, roundQty((merged.get(item.id) ?? 0) + quantity));
  }
  if (merged.size === 0) throw new StockError("Pick at least one item for this group.");
  if (merged.size > 80) throw new StockError("A group can hold up to 80 lines.");
  db.prepare("DELETE FROM bom_lines WHERE bom_id = ?").run(bomId);
  const insert = db.prepare(
    "INSERT INTO bom_lines (id, bom_id, item_id, quantity) VALUES (?, ?, ?, ?)",
  );
  for (const [itemId, quantity] of merged) {
    if (quantity > 1_000_000_000) throw new StockError("That quantity is too large.");
    insert.run(crypto.randomUUID(), bomId, itemId, quantity);
  }
}

export function createBom(
  db: Database,
  input: { name: string; notes: string; lines: BomLineInput[] },
  now = new Date().toISOString(),
): Bom {
  const run = db.transaction(() => {
    const id = crypto.randomUUID();
    const name = requireText(
      input.name,
      120,
      "Give the group a name.",
      "That name is too long.",
    );
    const notes = optionalText(input.notes, 500, "That note is too long.");
    db.prepare(
      "INSERT INTO boms (id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(id, name, notes, now, now);
    replaceBomLines(db, id, input.lines);
    const bom = getBom(db, id);
    if (!bom) throw new StockError("The group didn't save.");
    return bom;
  });
  return run();
}

export function updateBom(
  db: Database,
  id: string,
  input: { name: string; notes: string; lines: BomLineInput[] },
  now = new Date().toISOString(),
): Bom {
  const run = db.transaction(() => {
    const current = getBom(db, id);
    if (!current) throw new StockError("That bill of materials is no longer here.");
    const name = requireText(
      input.name,
      120,
      "Give the group a name.",
      "That name is too long.",
    );
    const notes = optionalText(input.notes, 500, "That note is too long.");
    db.prepare("UPDATE boms SET name = ?, notes = ?, updated_at = ? WHERE id = ?").run(
      name,
      notes,
      now,
      id,
    );
    replaceBomLines(db, id, input.lines);
    const bom = getBom(db, id);
    if (!bom) throw new StockError("The group didn't save.");
    return bom;
  });
  return run();
}

export function deleteBom(db: Database, id: string): void {
  const result = db.prepare("DELETE FROM boms WHERE id = ?").run(id);
  if (result.changes === 0) throw new StockError("That bill of materials is already gone.");
}

export function checkOutBom(
  db: Database,
  input: { bomId: string; person: string; note: string; now?: string },
): { bom: Bom; movements: MovementRecord[]; notices: Notice[] } {
  const now = input.now ?? new Date().toISOString();
  const person = optionalText(input.person, 80, "That name is too long.");
  if (!person) throw new StockError("Put your name on the ledger, so we know who took it.");
  const note = optionalText(input.note, 500, "That note is too long.");
  const run = db.transaction(() => {
    const bom = getBom(db, input.bomId);
    if (!bom) throw new StockError("That bill of materials is no longer here.");
    if (bom.lines.length === 0) {
      throw new StockError("This group has no lines to take out.");
    }
    const shortages = bom.lines
      .filter((line) => line.quantity > line.inStock)
      .map((line) => {
        const stock = formatQty(line.inStock);
        const verb = line.inStock === 1 ? "is" : "are";
        return `${line.name} needs ${formatQty(line.quantity)} and ${stock} ${verb} in stock`;
      });
    if (shortages.length > 0) {
      throw new StockError(`This group has to leave together. ${shortages.join(". ")}.`);
    }
    const batchId = crypto.randomUUID();
    const movements: MovementRecord[] = [];
    const notices: Notice[] = [];
    for (const line of bom.lines) {
      const outcome = moveStock(db, {
        itemId: line.itemId,
        kind: "out",
        amount: line.quantity,
        person,
        note,
        now,
        batchId,
        batchName: bom.name,
      });
      movements.push(outcome.movement);
      if (outcome.notice) notices.push(outcome.notice);
    }
    return { bom, movements, notices };
  });
  return run();
}
