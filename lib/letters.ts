import { formatQty, movementLine } from "@/lib/stock-rules";
import type { MovementKind } from "@/lib/types";

export type LetterItem = {
  name: string;
  sku: string;
  unit: string;
  supplier: string;
  category: string;
  quantity: number;
  lowStockAt: number;
  notes: string;
};

export type LetterMovement = {
  kind: MovementKind;
  amount: number;
  newQuantity: number;
  unit: string;
  person: string;
  note: string;
  when: string;
};

function factLines(item: LetterItem): string {
  const rows: [string, string][] = [
    ["In stock", `${formatQty(item.quantity)} ${item.unit}`],
    ["Reorder at", `${formatQty(item.lowStockAt)} ${item.unit}`],
  ];
  if (item.sku) rows.push(["SKU", item.sku]);
  if (item.supplier) rows.push(["Supplier", item.supplier]);
  if (item.category) rows.push(["Where", item.category]);
  if (item.notes) rows.push(["Note", item.notes]);
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join("\n");
}

function otherLines(items: LetterItem[]): string {
  return items
    .map(
      (item) =>
        `• ${item.name} — ${formatQty(item.quantity)} ${item.unit} in stock, reorder at ${formatQty(item.lowStockAt)} ${item.unit}${item.supplier ? ` (${item.supplier})` : ""}`,
    )
    .join("\n");
}

function closing(siteName: string, link: string | null): string {
  if (link) {
    return `Open the order list:\n${link}`;
  }
  return `Open ${siteName} on the workshop network and look at the order list.`;
}

export function itemLetter(input: {
  siteName: string;
  item: LetterItem;
  movement: LetterMovement | null;
  others: LetterItem[];
  link: string | null;
}): { subject: string; text: string } {
  const { item } = input;
  const subject = `Low stock: ${item.name} needs ordering (${formatQty(item.quantity)} ${item.unit} left)`;
  const parts = [
    `${item.name} is low and needs ordering.`,
    "",
    factLines(item),
  ];
  if (input.movement) {
    const who = input.movement.person ? ` — ${input.movement.person}` : "";
    const note = input.movement.note ? ` — ${input.movement.note}` : "";
    parts.push(
      "",
      "Last change",
      `${movementLine(input.movement.kind, input.movement.amount, input.movement.unit, input.movement.newQuantity)}${who}${note}`,
      input.movement.when,
    );
  }
  if (input.others.length > 0) {
    parts.push("", "Also low and needing an order", otherLines(input.others));
  }
  parts.push("", closing(input.siteName, input.link), "", `— ${input.siteName}`);
  return { subject, text: parts.join("\n") };
}

export function digestLetter(input: {
  siteName: string;
  items: LetterItem[];
  link: string | null;
}): { subject: string; text: string } {
  const count = input.items.length;
  const subject = `Low stock: ${count} ${count === 1 ? "item needs" : "items need"} ordering`;
  const blocks = input.items.map((item) =>
    [`${item.name}`, factLines(item)].join("\n"),
  );
  const text = [
    `${count === 1 ? "This item is" : "These items are"} low and need ordering.`,
    "",
    blocks.join("\n\n"),
    "",
    closing(input.siteName, input.link),
    "",
    `— ${input.siteName}`,
  ].join("\n");
  return { subject, text };
}

export function testLetter(siteName: string): { subject: string; text: string } {
  return {
    subject: `${siteName} test — this inbox can take reorder mail`,
    text: [
      `This is a test from ${siteName}.`,
      "",
      "When a counted item reaches its reorder line, the low-stock email will come to this address.",
      "Taking more off the shelf while it is already low will not send another one, until the count is brought back above the line and falls again.",
      "",
      `— ${siteName}`,
    ].join("\n"),
  };
}
