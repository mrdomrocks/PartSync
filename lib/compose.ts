import type { Database } from "better-sqlite3";
import {
  getItem,
  getMessage,
  getMovement,
  lowItems,
  messagePayload,
} from "@/lib/inventory";
import { digestLetter, itemLetter, testLetter, type LetterItem } from "@/lib/letters";
import { isLow } from "@/lib/stock-rules";
import type { Settings, ShelfItem } from "@/lib/types";
import { formatWhen } from "@/lib/time";

function toLetterItem(item: ShelfItem): LetterItem | null {
  if (item.lowStockAt == null) return null;
  return {
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    supplier: item.supplier,
    category: item.category,
    quantity: item.quantity,
    lowStockAt: item.lowStockAt,
    notes: item.notes,
  };
}

export function reorderLink(publicUrl: string): string | null {
  const trimmed = publicUrl.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  return `${trimmed}/reorder`;
}

export function composeMessage(
  db: Database,
  messageId: string,
  settings: Settings,
): { subject: string; text: string } | null {
  const message = getMessage(db, messageId);
  if (!message || message.status === "cancelled") return null;
  const link = reorderLink(settings.publicUrl);

  if (message.kind === "test") {
    return testLetter(settings.siteName);
  }

  if (message.kind === "digest") {
    const items = lowItems(db).flatMap((item) => {
      const letter = toLetterItem(item);
      return letter ? [letter] : [];
    });
    if (items.length === 0) return null;
    return digestLetter({ siteName: settings.siteName, items, link });
  }

  const payload = messagePayload(message);
  const itemId = message.itemId ?? payload.itemId;
  const item = itemId ? getItem(db, itemId) : null;
  if (!item || !isLow(item.quantity, item.lowStockAt)) return null;
  const letterItem = toLetterItem(item);
  if (!letterItem) return null;
  const movement = payload.movementId ? getMovement(db, payload.movementId) : null;
  const others = lowItems(db).flatMap((other) => {
    if (other.id === item.id) return [];
    const letter = toLetterItem(other);
    return letter ? [letter] : [];
  });
  return itemLetter({
    siteName: settings.siteName,
    item: letterItem,
    movement: movement
      ? {
          kind: movement.kind,
          amount: movement.amount,
          newQuantity: movement.newQuantity,
          unit: movement.itemUnit,
          person: movement.person,
          note: movement.note,
          when: formatWhen(movement.createdAt, settings.timeZone),
        }
      : null,
    others,
    link,
  });
}
