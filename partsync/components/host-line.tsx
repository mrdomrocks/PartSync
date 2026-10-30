import { headers } from "next/headers";
import { connection } from "next/server";

export async function HostLine({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  await connection();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return null;
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}`;
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const copy = local
    ? `On this machine at ${url}. Phones and other computers need the Pi's own address.`
    : `On this network at ${url}.`;
  return (
    <p
      className={
        tone === "paper"
          ? "text-xs leading-5 break-all text-primary-foreground/75"
          : "text-xs leading-5 break-all text-muted-foreground"
      }
    >
      {copy}
    </p>
  );
}
