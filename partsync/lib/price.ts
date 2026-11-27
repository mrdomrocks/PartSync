import type { PriceTax } from "@/lib/types";

export type PriceQuote =
  | { ok: true; amount: number; currency: string; tax: PriceTax }
  | { ok: false; detail: string };

type FoundPrice = {
  sku: string;
  amount: number;
  currency: string;
  tax: PriceTax;
  listed: boolean;
};

const NO_PRICE: PriceQuote = {
  ok: false,
  detail: "The supplier page didn't include a price.",
};

const MANY_PRICES: PriceQuote = {
  ok: false,
  detail: "That page lists more than one price. Paste the link to the product itself.",
};

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function parseMoneyAmount(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0 || raw > 1_000_000) return null;
    return roundMoney(raw);
  }
  if (typeof raw !== "string") return null;
  let text = raw.trim().replace(/\s/g, "");
  if (!text) return null;
  text = text.replace(/^[^\d.-]+/, "").replace(/[^\d.,-]+$/, "");
  if (!text) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    text =
      lastComma > lastDot
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const groups = text.split(",");
    const tail = groups[groups.length - 1] ?? "";
    text = tail.length === 3 ? groups.join("") : `${groups.slice(0, -1).join("")}.${tail}`;
  }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return roundMoney(value);
}

function currencyCode(raw: unknown, priceText: string): string {
  if (typeof raw === "string") {
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) return code;
    if (code === "£") return "GBP";
    if (code === "€") return "EUR";
  }
  if (priceText.includes("£")) return "GBP";
  if (priceText.includes("€")) return "EUR";
  return "";
}

function taxFlag(value: unknown): PriceTax {
  if (value === false) return "ex";
  if (value === true) return "inc";
  return "";
}

function skuKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typeNames(record: Record<string, unknown>): string[] {
  return asArray(record["@type"]).flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const trimmed = entry.trim();
    const slash = trimmed.lastIndexOf("/");
    const name = slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
    return name ? [name] : [];
  });
}

function skuOf(record: Record<string, unknown>): string {
  for (const key of ["sku", "mpn", "productID", "gtin13", "gtin", "gtin14", "gtin12"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function tierPrice(spec: unknown): { amount: number; currency: string; tax: PriceTax; min: number } | null {
  if (!spec || typeof spec !== "object") return null;
  const record = spec as Record<string, unknown>;
  const priceText = typeof record.price === "string" ? record.price : "";
  const amount = parseMoneyAmount(record.price ?? record.minPrice);
  if (amount == null) return null;
  let min = 1;
  const qty = record.eligibleQuantity;
  if (qty && typeof qty === "object") {
    const minValue = (qty as Record<string, unknown>).minValue;
    if (typeof minValue === "number" && Number.isFinite(minValue)) min = minValue;
  } else if (typeof record.minValue === "number" && Number.isFinite(record.minValue)) {
    min = record.minValue;
  }
  return {
    amount,
    currency: currencyCode(record.priceCurrency, priceText),
    tax: taxFlag(record.valueAddedTaxIncluded),
    min,
  };
}

function moneyFromOffer(record: Record<string, unknown>): Omit<FoundPrice, "sku" | "listed"> | null {
  const tiers = asArray(record.priceSpecification)
    .map(tierPrice)
    .filter((tier): tier is NonNullable<typeof tier> => tier != null)
    .sort((a, b) => a.min - b.min);
  if (tiers.length > 0) {
    const tier = tiers[0];
    return { amount: tier.amount, currency: tier.currency, tax: tier.tax };
  }
  const priceText = typeof record.price === "string" ? record.price : "";
  const amount = parseMoneyAmount(record.price ?? record.lowPrice);
  if (amount == null) return null;
  return {
    amount,
    currency: currencyCode(record.priceCurrency, priceText),
    tax: taxFlag(record.valueAddedTaxIncluded),
  };
}

function pushOffer(
  into: FoundPrice[],
  record: Record<string, unknown>,
  sku: string,
  listed: boolean,
) {
  const money = moneyFromOffer(record);
  if (!money) return;
  into.push({ ...money, sku, listed });
}

function walk(node: unknown, into: FoundPrice[], listed: boolean) {
  if (Array.isArray(node)) {
    for (const entry of node) walk(entry, into, listed);
    return;
  }
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (record["@graph"]) walk(record["@graph"], into, listed);
  const types = typeNames(record);
  if (types.includes("ItemList")) walk(record.itemListElement, into, true);
  if (types.includes("ListItem") && record.item) walk(record.item, into, true);
  const product = types.some((type) => type === "Product" || type.endsWith("Product"));
  if (product) {
    const productSku = skuOf(record);
    const offers = asArray(record.offers);
    if (offers.length === 0) pushOffer(into, record, productSku, listed);
    for (const offer of offers) {
      if (!offer || typeof offer !== "object") continue;
      const offerRecord = offer as Record<string, unknown>;
      pushOffer(into, offerRecord, skuOf(offerRecord) || productSku, listed);
    }
    return;
  }
  if (types.includes("Offer") || types.includes("AggregateOffer")) {
    pushOffer(into, record, skuOf(record), listed);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function jsonLdPrices(html: string): FoundPrice[] {
  const found: FoundPrice[] = [];
  const scripts = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scripts)) {
    const attrs = match[1] ?? "";
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    const body = decodeEntities((match[2] ?? "").trim());
    if (!body) continue;
    try {
      walk(JSON.parse(body) as unknown, found, false);
    } catch {
      // A broken script is skipped. Another one on the page may still hold a price.
    }
  }
  return found;
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return decodeEntities(match?.[2] ?? match?.[3] ?? "").trim();
}

function metaPrice(html: string): FoundPrice | null {
  let amountText = "";
  let currency = "";
  const tags = html.match(/<(?:meta|span|div)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const property = attr(tag, "property") || attr(tag, "itemprop") || attr(tag, "name");
    const content = attr(tag, "content");
    if (!property || !content) continue;
    const key = property.toLowerCase();
    if (
      key === "product:price:amount" ||
      key === "og:price:amount" ||
      key === "price" ||
      key === "lowprice"
    ) {
      if (!amountText) amountText = content;
    }
    if (key === "product:price:currency" || key === "og:price:currency" || key === "pricecurrency") {
      if (!currency) currency = content;
    }
  }
  const amount = parseMoneyAmount(amountText);
  if (amount == null) return null;
  return {
    sku: "",
    amount,
    currency: currencyCode(currency, amountText),
    tax: "",
    listed: false,
  };
}

function choose(offers: FoundPrice[], sku: string): PriceQuote {
  if (offers.length === 0) return NO_PRICE;
  const wanted = skuKey(sku);
  if (wanted) {
    const matches = offers.filter((offer) => skuKey(offer.sku) === wanted);
    const match = matches.find((offer) => !offer.listed) ?? matches[0];
    if (match) {
      return { ok: true, amount: match.amount, currency: match.currency, tax: match.tax };
    }
  }
  const loose = offers.filter((offer) => !offer.listed);
  const pool = loose.length > 0 ? loose : offers;
  if (pool.length === 1) {
    const only = pool[0];
    return { ok: true, amount: only.amount, currency: only.currency, tax: only.tax };
  }
  return MANY_PRICES;
}

export function extractPrice(html: string, sku = ""): PriceQuote {
  const structured = jsonLdPrices(html);
  const chosen = choose(structured, sku);
  if (chosen.ok) return chosen;
  if (structured.length > 0) return chosen;
  const meta = metaPrice(html);
  if (meta) return { ok: true, amount: meta.amount, currency: meta.currency, tax: meta.tax };
  return NO_PRICE;
}
