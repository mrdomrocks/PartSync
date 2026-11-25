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

export function labelTarget(
  publicUrl: string,
  requestOrigin: string,
  id: string,
): { url: string; warning: string | null } {
  const origin = httpOrigin(publicUrl) || httpOrigin(requestOrigin);
  const url = origin ? `${origin}${itemTakePath(id)}` : itemTakePath(id);
  return {
    url,
    warning: isLocalOrigin(origin) ? LABEL_ADDRESS_WARNING : null,
  };
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
