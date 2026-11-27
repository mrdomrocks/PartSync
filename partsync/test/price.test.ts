import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import { composeMessage } from "../lib/compose";
import { openDatabase } from "../lib/db";
import { createItem, getItem, recordPrice, updateItem } from "../lib/inventory";
import { itemLetter } from "../lib/letters";
import { formatMoney } from "../lib/money";
import { extractPrice } from "../lib/price";
import { isBlockedAddress } from "../lib/public-url";
import { readSettings } from "../lib/settings";
import { checkPublicUrl, readSupplierQuote } from "../lib/supplier-fetch";
import { supplierPage, supplierSearch } from "../lib/suppliers";

const publicAddress = async () => [{ address: "93.184.216.34" }];

function jsonLd(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

describe("supplier links", () => {
  it("builds a search link from a known supplier and a SKU", () => {
    assert.equal(
      supplierSearch("RS Components Ltd", "188-1238"),
      "https://uk.rs-online.com/web/c/?searchTerm=188-1238",
    );
    assert.equal(
      supplierSearch("Viking", "6857433"),
      "https://www.viking-direct.co.uk/en/search?text=6857433",
    );
    assert.equal(supplierSearch("Corner shop", "6857433"), null);
    assert.equal(supplierSearch("RS", ""), null);
  });

  it("uses a pasted product page ahead of a supplier search", () => {
    const page = supplierPage({
      supplier: "Viking",
      sku: "6857433",
      productUrl: "https://www.viking-direct.co.uk/en/paper-p-6857433",
    });
    assert.equal(page?.kind, "product");
    assert.equal(page?.href, "https://www.viking-direct.co.uk/en/paper-p-6857433");
    const search = supplierPage({ supplier: "Screwfix", sku: "12345", productUrl: "" });
    assert.equal(search?.kind, "search");
    assert.match(search?.href ?? "", /screwfix\.com\/search\?search=12345/);
  });
});

describe("reading a price from a supplier page", () => {
  it("takes the single-unit price, not the bulk from-price", () => {
    const html = jsonLd({
      "@context": "https://schema.org",
      "@type": "Product",
      sku: "6857433",
      offers: {
        "@type": "Offer",
        priceCurrency: "GBP",
        price: 3.99,
        priceSpecification: [
          {
            "@type": "UnitPriceSpecification",
            price: 4.79,
            priceCurrency: "GBP",
            valueAddedTaxIncluded: false,
            eligibleQuantity: { "@type": "QuantitativeValue", minValue: 1, maxValue: 4 },
          },
          {
            "@type": "UnitPriceSpecification",
            price: 3.99,
            priceCurrency: "GBP",
            valueAddedTaxIncluded: false,
            eligibleQuantity: { "@type": "QuantitativeValue", minValue: 10 },
          },
        ],
      },
    });
    const quote = extractPrice(html, "6857433");
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.amount, 4.79);
    assert.equal(quote.currency, "GBP");
    assert.equal(quote.tax, "ex");
    assert.equal(formatMoney(quote.amount, quote.currency, quote.tax), "£4.79 ex VAT");
  });

  it("picks the product whose SKU matches when a page lists several", () => {
    const html = jsonLd({
      "@type": "ItemList",
      itemListElement: [
        { "@type": "ListItem", item: { "@type": "Product", sku: "111", offers: { price: "1.00", priceCurrency: "GBP" } } },
        { "@type": "ListItem", item: { "@type": "Product", sku: "GLV-M", offers: { price: "12.40", priceCurrency: "GBP" } } },
      ],
    });
    const quote = extractPrice(html, "glv m");
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.amount, 12.4);
    const ambiguous = extractPrice(html, "NO-SUCH");
    assert.equal(ambiguous.ok, false);
  });

  it("reads a meta price when the page has no product data", () => {
    const html = `<meta property="product:price:amount" content="1,234.50"><meta property="product:price:currency" content="GBP">`;
    const quote = extractPrice(html, "");
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.amount, 1234.5);
    assert.equal(quote.currency, "GBP");
  });

  it("refuses a loopback address and a redirect onto one", async () => {
    assert.equal(isBlockedAddress("127.0.0.1"), true);
    assert.equal(isBlockedAddress("192.168.1.20"), false);
    const local = await checkPublicUrl("http://127.0.0.1/secret", publicAddress);
    assert.equal(local.ok, false);
    let calls = 0;
    const quote = await readSupplierQuote("https://shop.example/gloves", "GLV-M", {
      resolve: publicAddress,
      fetch: async () => {
        calls += 1;
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        });
      },
    });
    assert.equal(quote.ok, false);
    assert.equal(calls, 1);
    if (quote.ok) return;
    assert.match(quote.detail, /isn't a supplier page/);
  });

  it("reads the price from the fetched page", async () => {
    const html = jsonLd({
      "@type": "Product",
      sku: "GLV-M",
      offers: { "@type": "Offer", price: "12.40", priceCurrency: "GBP", valueAddedTaxIncluded: true },
    });
    const quote = await readSupplierQuote("https://shop.example/gloves", "GLV-M", {
      resolve: publicAddress,
      fetch: async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }),
    });
    assert.equal(quote.ok, true);
    if (!quote.ok) return;
    assert.equal(quote.amount, 12.4);
    assert.equal(quote.tax, "inc");
  });
});

describe("prices on the shelf and in the reorder email", () => {
  it("adds the price columns to a cupboard created before them", () => {
    const file = path.join(os.tmpdir(), `partsync-price-${crypto.randomUUID()}.db`);
    const created = new Database(file);
    created.exec(`
      CREATE TABLE items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL DEFAULT 'each',
        quantity REAL NOT NULL DEFAULT 0,
        low_stock_at REAL,
        supplier TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        alert_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    created.close();
    const opened = openDatabase(file);
    const names = new Set(
      (opened.prepare("PRAGMA table_info(items)").all() as { name: string }[]).map((row) => row.name),
    );
    assert.equal(names.has("product_url"), true);
    assert.equal(names.has("price_amount"), true);
    assert.equal(names.has("price_checked_at"), true);
    opened.close();
    fs.rmSync(file, { force: true });
  });

  it("keeps a price when the note changes, and clears it when the SKU changes", () => {
    const db = openDatabase(":memory:");
    const created = createItem(db, {
      name: "Gloves",
      sku: "GLV-M",
      category: "",
      unit: "boxes",
      quantity: 2,
      lowStockAt: 4,
      supplier: "Medisupply",
      productUrl: "https://shop.example/gloves",
      notes: "",
    });
    recordPrice(db, created.item.id, {
      amount: 12.4,
      currency: "GBP",
      tax: "inc",
      detail: "",
      checkedAt: "2026-11-27T12:00:00.000Z",
    });
    const noted = updateItem(db, created.item.id, { ...created.item, notes: "Powder-free." });
    assert.equal(noted.item.priceAmount, 12.4);
    assert.equal(noted.item.productUrl, "https://shop.example/gloves");
    const changed = updateItem(db, created.item.id, { ...created.item, sku: "GLV-L" });
    assert.equal(changed.item.priceAmount, null);
    assert.equal(changed.item.priceDetail, "");
    assert.throws(
      () => createItem(db, { ...created.item, name: "Bad", productUrl: "javascript:alert(1)" }),
      /http/,
    );
    db.close();
  });

  it("puts the SKU, supplier, price, and links in the reorder email", () => {
    const db = openDatabase(":memory:");
    const created = createItem(db, {
      name: "Nitrile gloves <M>",
      sku: "GLV-M",
      category: "Workshop",
      unit: "boxes",
      quantity: 2,
      lowStockAt: 4,
      supplier: "Viking",
      productUrl: "https://shop.example/gloves?id=1",
      notes: "",
    });
    assert.ok(created.notice);
    recordPrice(db, created.item.id, {
      amount: 12.4,
      currency: "GBP",
      tax: "ex",
      detail: "",
    });
    const item = getItem(db, created.item.id);
    assert.ok(item);
    const settings = readSettings(db).values;
    const letter = composeMessage(db, created.notice.messageId, {
      ...settings,
      publicUrl: "http://192.168.1.20:4747",
    });
    assert.ok(letter);
    assert.match(letter.text, /SKU\s+GLV-M/);
    assert.match(letter.text, /Supplier\s+Viking/);
    assert.match(letter.text, /Supplier page\s+https:\/\/shop\.example\/gloves\?id=1/);
    assert.match(letter.text, /£12\.40 ex VAT/);
    assert.match(letter.text, /http:\/\/192\.168\.1\.20:4747\/items\//);
    assert.match(letter.html, /href="https:\/\/shop\.example\/gloves\?id=1"/);
    assert.match(letter.html, /Nitrile gloves &lt;M&gt;/);
    const plain = itemLetter({
      siteName: "Workshop stores",
      item: {
        name: "Paper",
        sku: "6857433",
        unit: "reams",
        supplier: "Viking",
        category: "",
        quantity: 1,
        lowStockAt: 2,
        notes: "",
        supplierUrl: "https://www.viking-direct.co.uk/en/search?text=6857433",
        supplierKind: "search",
        price: "£4.79 ex VAT",
      },
      movement: null,
      others: [],
      link: null,
    });
    assert.match(plain.text, /Supplier search\s+https:\/\/www\.viking-direct\.co\.uk\/en\/search\?text=6857433/);
    db.close();
  });
});
