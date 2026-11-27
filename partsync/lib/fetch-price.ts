import "server-only";
import type { Database } from "better-sqlite3";
import { getItem, lowItems, recordPrice } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { readSupplierQuote } from "@/lib/supplier-fetch";
import { supplierPage } from "@/lib/suppliers";
import type { ShelfItem } from "@/lib/types";

const FRESH_PRICE_MS = 12 * 60 * 60 * 1000;
const FRESH_MISS_MS = 60 * 60 * 1000;

export function priceNeedsRefresh(
  item: Pick<ShelfItem, "priceAmount" | "priceCheckedAt">,
  now = Date.now(),
): boolean {
  if (!item.priceCheckedAt) return true;
  const checked = Date.parse(item.priceCheckedAt);
  if (!Number.isFinite(checked)) return true;
  const limit = item.priceAmount == null ? FRESH_MISS_MS : FRESH_PRICE_MS;
  return now - checked >= limit;
}

export async function refreshItemPrice(
  db: Database,
  id: string,
): Promise<{ note: string; found: boolean }> {
  const item = getItem(db, id);
  if (!item) return { note: "That item is no longer on the catalogue.", found: false };
  const page = supplierPage(item);
  if (!page) {
    return {
      note: "Add a product page link, or a SKU for a supplier PartSync can look up.",
      found: false,
    };
  }
  const quote = await readSupplierQuote(page.href, item.sku);
  recordPrice(db, id, {
    amount: quote.ok ? quote.amount : null,
    currency: quote.ok ? quote.currency : "",
    tax: quote.ok ? quote.tax : "",
    detail: quote.ok ? "" : quote.detail,
  });
  if (!quote.ok) return { note: quote.detail, found: false };
  return {
    note: `Supplier price is ${formatMoney(quote.amount, quote.currency, quote.tax)}.`,
    found: true,
  };
}

async function runPool<T>(items: T[], width: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(width, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      await task(next);
    }
  });
  await Promise.all(workers);
}

export async function refreshStalePrices(db: Database, items: ShelfItem[]): Promise<void> {
  const due = items.filter((item) => supplierPage(item) && priceNeedsRefresh(item)).slice(0, 6);
  await runPool(due, 3, async (item) => {
    try {
      await refreshItemPrice(db, item.id);
    } catch (error) {
      console.error(error);
    }
  });
}

export async function refreshLowPrices(
  db: Database,
): Promise<{ found: number; checked: number }> {
  const items = lowItems(db).filter((item) => supplierPage(item)).slice(0, 12);
  let found = 0;
  await runPool(items, 3, async (item) => {
    try {
      const result = await refreshItemPrice(db, item.id);
      if (result.found) found += 1;
    } catch (error) {
      console.error(error);
    }
  });
  return { found, checked: items.length };
}
