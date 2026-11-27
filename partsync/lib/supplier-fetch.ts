import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractPrice, type PriceQuote } from "@/lib/price";
import { isBlockedAddress, isBlockedHostname } from "@/lib/public-url";

const PAGE_LIMIT = 1_500_000;

export type AddressLookup = (hostname: string) => Promise<{ address: string }[]>;

async function defaultLookup(hostname: string): Promise<{ address: string }[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

export async function checkPublicUrl(
  raw: string,
  resolve: AddressLookup = defaultLookup,
): Promise<{ ok: true; href: string } | { ok: false; detail: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, detail: "That product page link couldn't be read." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, detail: "The product page link should start with http:// or https://." };
  }
  if (url.username || url.password) {
    return { ok: false, detail: "The product page link shouldn't include a password." };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const blocked = "That address isn't a supplier page PartSync can open.";
  if (isBlockedHostname(host)) return { ok: false, detail: blocked };
  try {
    if (isIP(host)) {
      if (isBlockedAddress(host)) return { ok: false, detail: blocked };
      return { ok: true, href: url.toString() };
    }
    const addresses = await resolve(host);
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return { ok: false, detail: blocked };
    }
  } catch {
    return { ok: false, detail: "Couldn't reach the supplier." };
  }
  return { ok: true, href: url.toString() };
}

async function readLimited(response: Response, max: number): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, max);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let out = "";
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (size >= max) break;
  }
  try {
    await reader.cancel();
  } catch {
    // The supplier can close the body while we stop early.
  }
  out += decoder.decode();
  return out.slice(0, max);
}

async function fetchPublicPage(
  start: string,
  fetchImpl: typeof fetch,
  resolve: AddressLookup,
): Promise<{ ok: true; html: string } | { ok: false; detail: string }> {
  let current = start;
  for (let hop = 0; hop < 5; hop += 1) {
    const checked = await checkPublicUrl(current, resolve);
    if (!checked.ok) return checked;
    let response: Response;
    try {
      response = await fetchImpl(checked.href, {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-GB,en",
          "User-Agent": "PartSync/1.0 (workshop stock price check)",
        },
      });
    } catch {
      return { ok: false, detail: "Couldn't reach the supplier." };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { ok: false, detail: "The supplier page redirected nowhere." };
      try {
        current = new URL(location, checked.href).toString();
      } catch {
        return { ok: false, detail: "The supplier page redirected nowhere." };
      }
      continue;
    }
    if (!response.ok) return { ok: false, detail: "The supplier page didn't open." };
    const type = response.headers.get("content-type") ?? "";
    if (type && !/html|xml|json|text\/plain/i.test(type)) {
      return { ok: false, detail: "That page isn't one PartSync can read a price from." };
    }
    const length = Number(response.headers.get("content-length"));
    if (Number.isFinite(length) && length > PAGE_LIMIT * 2) {
      return { ok: false, detail: "That supplier page is too large to read a price from." };
    }
    return { ok: true, html: await readLimited(response, PAGE_LIMIT) };
  }
  return { ok: false, detail: "The supplier page redirected too many times." };
}

export async function readSupplierQuote(
  href: string,
  sku: string,
  deps: { fetch?: typeof fetch; resolve?: AddressLookup } = {},
): Promise<PriceQuote> {
  const page = await fetchPublicPage(href, deps.fetch ?? fetch, deps.resolve ?? defaultLookup);
  if (!page.ok) return page;
  return extractPrice(page.html, sku);
}
