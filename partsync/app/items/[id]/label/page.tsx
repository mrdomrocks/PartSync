import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { getItem } from "@/lib/inventory";
import { labelTarget } from "@/lib/labels";
import { liveDb } from "@/lib/live";
import { qrSvg } from "@/lib/qr-svg";
import { readSettings } from "@/lib/settings";

export const metadata = {
  title: "Shelf label",
};

export default function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the label" />}>
      <LabelScreen params={params} />
    </Suspense>
  );
}

async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function LabelScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await liveDb();
  const item = getItem(db, id);
  if (!item) {
    return (
      <div className="max-w-lg">
        <h1 className="font-heading text-4xl tracking-tight">That item isn’t on the shelf</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          It may have been removed, or the address is wrong.
        </p>
        <Link href="/catalogue" className="mt-5 inline-block text-sm underline underline-offset-4">
          Back to the catalogue
        </Link>
      </div>
    );
  }
  const settings = readSettings(db).values;
  const target = labelTarget(settings.publicUrl, await requestOrigin(), item.id);
  const svg = await qrSvg(target.url);
  const detail = [item.category, item.sku].filter(Boolean).join(" · ");

  return (
    <article className="label-sheet mx-auto w-full max-w-sm rounded-xl border border-border bg-card px-6 py-8 text-center">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">PartSync</p>
      <h1 className="mt-3 font-heading text-3xl tracking-tight text-balance">{item.name}</h1>
      {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
      <div
        className="label-qr mx-auto mt-6 w-fit [&_svg]:h-auto [&_svg]:w-56"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-4 text-sm">Scan to take from stock</p>
      <p className="mt-2 text-xs break-all text-muted-foreground">{target.url}</p>
      {target.warning ? (
        <p className="mt-3 text-sm leading-6 text-low-ink">{target.warning}</p>
      ) : null}
      <div className="no-print mt-6 flex flex-col items-center gap-3">
        <PrintButton label="Print this label" />
        <Link href={`/items/${item.id}`} className="text-sm underline underline-offset-4">
          Back to the item
        </Link>
      </div>
    </article>
  );
}
