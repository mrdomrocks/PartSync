import { isIP } from "node:net";

export function isBlockedAddress(ip: string): boolean {
  const bare = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedAddress(mapped[1]);
  const version = isIP(bare);
  if (version === 4) {
    const [a, b] = bare.split(".").map((part) => Number(part));
    if (a === 0 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    if (bare === "::1" || bare === "::") return true;
    const head = Number.parseInt(bare.split(":")[0] || "0", 16);
    if ((head & 0xffc0) === 0xfe80) return true;
    if ((head & 0xfe00) === 0xfc00) return true;
    return false;
  }
  return true;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (
    host === "metadata.google.internal" ||
    host.endsWith(".metadata.google.internal") ||
    host === "metadata.google.com"
  ) {
    return true;
  }
  if (isIP(host)) return isBlockedAddress(host);
  return false;
}
