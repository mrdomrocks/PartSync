export const KNOWN_SUPPLIER_NAMES =
  "RS, Screwfix, Toolstation, Farnell, CPC, Digi-Key, Mouser, Rapid, Viking, and Amazon";

type SupplierRule = {
  aliases: string[];
  search: (sku: string) => string;
};

const SUPPLIERS: SupplierRule[] = [
  {
    aliases: ["rs components", "rs online", "rs pro", "rs"],
    search: (sku) => `https://uk.rs-online.com/web/c/?searchTerm=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["screwfix"],
    search: (sku) => `https://www.screwfix.com/search?search=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["toolstation"],
    search: (sku) => `https://www.toolstation.com/search?q=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["cpc farnell", "cpc"],
    search: (sku) => `https://cpc.farnell.com/search?st=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["element 14", "element14", "farnell"],
    search: (sku) => `https://uk.farnell.com/search?st=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["digi key", "digikey"],
    search: (sku) =>
      `https://www.digikey.co.uk/en/products/result?keywords=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["mouser"],
    search: (sku) => `https://www.mouser.co.uk/c/?q=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["rapid electronics", "rapid"],
    search: (sku) => `https://www.rapidonline.com/search?query=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["viking direct", "viking"],
    search: (sku) =>
      `https://www.viking-direct.co.uk/en/search?text=${encodeURIComponent(sku)}`,
  },
  {
    aliases: ["amazon uk", "amazon"],
    search: (sku) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(sku)}`,
  },
];

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES = SUPPLIERS.flatMap((rule) =>
  rule.aliases.map((alias) => ({ alias: normalise(alias), search: rule.search })),
).sort((a, b) => b.alias.length - a.alias.length);

export function supplierSearch(supplier: string, sku: string): string | null {
  const name = normalise(supplier);
  const code = sku.trim();
  if (!name || !code) return null;
  for (const entry of ALIASES) {
    const hit =
      name === entry.alias ||
      name.startsWith(`${entry.alias} `) ||
      name.endsWith(` ${entry.alias}`) ||
      name.includes(` ${entry.alias} `);
    if (hit) return entry.search(code);
  }
  return null;
}

export type SupplierLink = {
  href: string;
  kind: "product" | "search";
};

export function supplierPage(item: {
  supplier: string;
  sku: string;
  productUrl: string;
}): SupplierLink | null {
  const pasted = item.productUrl.trim();
  if (pasted) {
    try {
      const url = new URL(pasted);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return { href: url.toString(), kind: "product" };
      }
    } catch {
      // A stored link that no longer parses falls through to a supplier search.
    }
  }
  const search = supplierSearch(item.supplier, item.sku);
  if (!search) return null;
  return { href: search, kind: "search" };
}
