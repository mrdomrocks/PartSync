const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const LABEL_ADDRESS_WARNING =
  "Phones cannot open this code until Setup has the address on the network, such as http://192.168.1.20:4747.";

export function itemTakePath(id: string): string {
  return `/items/${id}/take`;
}

export function itemLabelPath(id: string): string {
  return `/items/${id}/label`;
}

export function labelSheetPath(ids: string[]): string {
  const params = new URLSearchParams();
  for (const id of ids) params.append("id", id);
  const query = params.toString();
  return query ? `/labels?${query}` : "/labels";
}

export function bomTakePath(id: string): string {
  return `/boms/${id}/take`;
}

export function bomLabelPath(id: string): string {
  return `/boms/${id}/label`;
}

export function bomLabelSheetPath(ids: string[]): string {
  const params = new URLSearchParams();
  for (const id of ids) params.append("id", id);
  const query = params.toString();
  return query ? `/boms/labels?${query}` : "/boms/labels";
}

export function labelIdList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const piece of raw.join(",").split(",")) {
    const id = piece.trim().toLowerCase();
    if (!UUID.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function httpOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function isLocalOrigin(origin: string): boolean {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return true;
  }
}

function labelledUrl(
  publicUrl: string,
  requestOrigin: string,
  path: string,
): { url: string; warning: string | null } {
  const origin = httpOrigin(publicUrl) || httpOrigin(requestOrigin);
  const url = origin ? `${origin}${path}` : path;
  return {
    url,
    warning: isLocalOrigin(origin) ? LABEL_ADDRESS_WARNING : null,
  };
}

export function labelTarget(
  publicUrl: string,
  requestOrigin: string,
  id: string,
): { url: string; warning: string | null } {
  return labelledUrl(publicUrl, requestOrigin, itemTakePath(id));
}

export function bomLabelTarget(
  publicUrl: string,
  requestOrigin: string,
  id: string,
): { url: string; warning: string | null } {
  return labelledUrl(publicUrl, requestOrigin, bomTakePath(id));
}

export function parseScannedItem(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    try {
      url = new URL(text, "http://localhost");
    } catch {
      return null;
    }
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "items") return null;
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.length === 3 && parts[2] !== "take") return null;
  let id: string;
  try {
    id = decodeURIComponent(parts[1] ?? "");
  } catch {
    return null;
  }
  if (!UUID.test(id)) return null;
  return id.toLowerCase();
}
