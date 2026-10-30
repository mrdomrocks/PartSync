import { StockError } from "@/lib/errors";
import { roundQty } from "@/lib/stock-rules";
import type { BomLineInput, ItemDraft, MovementKind, SecureMode } from "@/lib/types";
import { isValidTimeZone } from "@/lib/time";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAmount(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new StockError("Enter a number, like 1 or 0.5.");
  }
  const value = roundQty(Number(trimmed));
  if (value > 1_000_000_000) {
    throw new StockError("That quantity is too large.");
  }
  return value;
}

export function parseThreshold(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new StockError("The reorder line should be a number, or left blank.");
  }
  const value = roundQty(Number(trimmed));
  if (value > 1_000_000_000) {
    throw new StockError("That reorder line is too large.");
  }
  return value;
}

export function parseKind(value: unknown): MovementKind {
  if (value === "out" || value === "in" || value === "set") return value;
  throw new StockError("That kind of stock change isn't recognised.");
}

function clip(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new StockError(`${label} is too long.`);
  }
  return trimmed;
}

export function itemDraftFromForm(formData: FormData): ItemDraft {
  const name = clip(String(formData.get("name") ?? ""), 120, "The name");
  if (!name) throw new StockError("Give the item a name.");
  const unit = clip(String(formData.get("unit") ?? ""), 30, "The unit") || "each";
  return {
    name,
    sku: clip(String(formData.get("sku") ?? ""), 60, "The SKU"),
    category: clip(String(formData.get("category") ?? ""), 60, "The place"),
    unit,
    lowStockAt: parseThreshold(String(formData.get("lowStockAt") ?? "")),
    supplier: clip(String(formData.get("supplier") ?? ""), 120, "The supplier"),
    notes: clip(String(formData.get("notes") ?? ""), 500, "The note"),
  };
}

export function bomDraftFromForm(formData: FormData): {
  name: string;
  notes: string;
  lines: BomLineInput[];
} {
  const raw = formData.getAll("line").map((value) => String(value));
  if (raw.length === 0) throw new StockError("Pick at least one item for this group.");
  const lines = raw.map((entry) => {
    const splitAt = entry.indexOf("|");
    if (splitAt <= 0) throw new StockError("One of the lines couldn't be read.");
    const itemId = entry.slice(0, splitAt).trim();
    const quantity = parseAmount(entry.slice(splitAt + 1));
    if (quantity <= 0) throw new StockError("Each line needs a quantity above zero.");
    return { itemId, quantity };
  });
  return {
    name: String(formData.get("name") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    lines,
  };
}

export function parseEmails(raw: string): string[] {
  const parts = raw
    .split(/[,;\n]+/)
    .flatMap((part) => part.trim().split(/\s+/))
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!EMAIL.test(part)) {
      throw new StockError(`${part} is not an email address.`);
    }
    const lower = part.toLowerCase();
    if (!unique.includes(lower)) unique.push(lower);
  }
  return unique;
}

export function parsePublicUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new StockError(
      "The network address should look like http://192.168.1.20:4747.",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new StockError("The network address should start with http:// or https://.");
  }
  return url.origin;
}

export function parseSecureMode(raw: string): SecureMode {
  if (raw === "starttls" || raw === "ssl" || raw === "none") return raw;
  throw new StockError("Choose STARTTLS, SSL, or no encryption.");
}

export function parseTimeZone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || !isValidTimeZone(trimmed)) {
    throw new StockError("Choose a time zone the clock understands.");
  }
  return trimmed;
}

export function parsePort(raw: string): string {
  const port = Number(raw.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new StockError("The SMTP port should be a number, usually 587 or 465.");
  }
  return String(port);
}
