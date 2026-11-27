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
  supplierUrl?: string;
  supplierKind?: "product" | "search";
  price?: string;
  itemUrl?: string;
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

export type Letter = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlValue(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    const safe = escapeHtml(value);
    return `<a href="${safe}">${safe}</a>`;
  }
  return escapeHtml(value);
}

function factRows(item: LetterItem): [string, string][] {
  const rows: [string, string][] = [
    ["In stock", `${formatQty(item.quantity)} ${item.unit}`],
    ["Reorder at", `${formatQty(item.lowStockAt)} ${item.unit}`],
  ];
  if (item.sku) rows.push(["SKU", item.sku]);
  if (item.supplier) rows.push(["Supplier", item.supplier]);
  if (item.supplierUrl) {
    rows.push([
      item.supplierKind === "search" ? "Supplier search" : "Supplier page",
      item.supplierUrl,
    ]);
  }
  if (item.price) rows.push(["Price", item.price]);
  if (item.category) rows.push(["Where", item.category]);
  if (item.notes) rows.push(["Note", item.notes]);
  if (item.itemUrl) rows.push(["Item page", item.itemUrl]);
  return rows;
}

function factLines(item: LetterItem): string {
  const rows = factRows(item);
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${label.padEnd(width)}  ${value}`).join("\n");
}

function factTable(item: LetterItem): string {
  const body = factRows(item)
    .map(
      ([label, value]) =>
        `<tr><td>${escapeHtml(label)}</td><td>${htmlValue(value)}</td></tr>`,
    )
    .join("");
  return `<table>${body}</table>`;
}

function otherLines(items: LetterItem[]): string {
  return items
    .map((item) => {
      const head = `• ${item.name} — ${formatQty(item.quantity)} ${item.unit} in stock, reorder at ${formatQty(item.lowStockAt)} ${item.unit}`;
      const extra: string[] = [];
      if (item.sku) extra.push(`SKU ${item.sku}`);
      if (item.supplier) extra.push(item.supplier);
      if (item.price) extra.push(item.price);
      const lines = [extra.length > 0 ? `${head} — ${extra.join(", ")}` : head];
      if (item.supplierUrl) lines.push(`  ${item.supplierUrl}`);
      if (item.itemUrl) lines.push(`  ${item.itemUrl}`);
      return lines.join("\n");
    })
    .join("\n");
}

function otherHtml(items: LetterItem[]): string {
  const blocks = items.map((item) => {
    const extra: string[] = [];
    if (item.sku) extra.push(`SKU ${escapeHtml(item.sku)}`);
    if (item.supplier) extra.push(escapeHtml(item.supplier));
    if (item.price) extra.push(escapeHtml(item.price));
    const head = `${escapeHtml(item.name)} — ${escapeHtml(`${formatQty(item.quantity)} ${item.unit}`)} in stock, reorder at ${escapeHtml(`${formatQty(item.lowStockAt)} ${item.unit}`)}`;
    const lines = [`<li>${extra.length > 0 ? `${head} — ${extra.join(", ")}` : head}`];
    if (item.supplierUrl) lines.push(`<br>${htmlValue(item.supplierUrl)}`);
    if (item.itemUrl) lines.push(`<br>${htmlValue(item.itemUrl)}`);
    lines.push("</li>");
    return lines.join("");
  });
  return `<ul>${blocks.join("")}</ul>`;
}

function closing(siteName: string, link: string | null): string {
  if (link) return `Open the order list:\n${link}`;
  return `Open ${siteName} on the workshop network and look at the order list.`;
}

function closingHtml(siteName: string, link: string | null): string {
  if (link) return `<p>Open the order list:<br>${htmlValue(link)}</p>`;
  return `<p>${escapeHtml(`Open ${siteName} on the workshop network and look at the order list.`)}</p>`;
}

function document(parts: string[]): string {
  return `<!DOCTYPE html><html><body>${parts.join("")}</body></html>`;
}

export function itemLetter(input: {
  siteName: string;
  item: LetterItem;
  movement: LetterMovement | null;
  others: LetterItem[];
  link: string | null;
}): Letter {
  const { item } = input;
  const subject = `Low stock: ${item.name} needs ordering (${formatQty(item.quantity)} ${item.unit} left)`;
  const parts = [`${item.name} is low and needs ordering.`, "", factLines(item)];
  const html = [`<p>${escapeHtml(`${item.name} is low and needs ordering.`)}</p>`, factTable(item)];
  if (input.movement) {
    const who = input.movement.person ? ` — ${input.movement.person}` : "";
    const note = input.movement.note ? ` — ${input.movement.note}` : "";
    const change = `${movementLine(input.movement.kind, input.movement.amount, input.movement.unit, input.movement.newQuantity)}${who}${note}`;
    parts.push("", "Last change", change, input.movement.when);
    html.push(
      `<p><strong>Last change</strong><br>${escapeHtml(change)}<br>${escapeHtml(input.movement.when)}</p>`,
    );
  }
  if (input.others.length > 0) {
    parts.push("", "Also low and needing an order", otherLines(input.others));
    html.push("<p><strong>Also low and needing an order</strong></p>", otherHtml(input.others));
  }
  parts.push("", closing(input.siteName, input.link), "", `— ${input.siteName}`);
  html.push(closingHtml(input.siteName, input.link), `<p>— ${escapeHtml(input.siteName)}</p>`);
  return { subject, text: parts.join("\n"), html: document(html) };
}

export function digestLetter(input: {
  siteName: string;
  items: LetterItem[];
  link: string | null;
}): Letter {
  const count = input.items.length;
  const subject = `Low stock: ${count} ${count === 1 ? "item needs" : "items need"} ordering`;
  const intro = `${count === 1 ? "This item is" : "These items are"} low and need ordering.`;
  const blocks = input.items.map((item) => [`${item.name}`, factLines(item)].join("\n"));
  const htmlBlocks = input.items.map(
    (item) => `<h2>${escapeHtml(item.name)}</h2>${factTable(item)}`,
  );
  const text = [intro, "", blocks.join("\n\n"), "", closing(input.siteName, input.link), "", `— ${input.siteName}`].join(
    "\n",
  );
  const html = document([
    `<p>${escapeHtml(intro)}</p>`,
    htmlBlocks.join(""),
    closingHtml(input.siteName, input.link),
    `<p>— ${escapeHtml(input.siteName)}</p>`,
  ]);
  return { subject, text, html };
}

export function testLetter(siteName: string): Letter {
  const text = [
    `This is a test from ${siteName}.`,
    "",
    "When a counted item reaches its reorder line, the low-stock email will come to this address.",
    "Taking more off the shelf while it is already low will not send another one, until the count is brought back above the line and falls again.",
    "",
    `— ${siteName}`,
  ].join("\n");
  return {
    subject: `${siteName} test — this inbox can take reorder mail`,
    text,
    html: document([
      `<p>${escapeHtml(`This is a test from ${siteName}.`)}</p>`,
      "<p>When a counted item reaches its reorder line, the low-stock email will come to this address.</p>",
      "<p>Taking more off the shelf while it is already low will not send another one, until the count is brought back above the line and falls again.</p>",
      `<p>— ${escapeHtml(siteName)}</p>`,
    ]),
  };
}
