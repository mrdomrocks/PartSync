import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { getBom } from "@/lib/inventory";
import { bomLabelTarget } from "@/lib/labels";
import { liveDb } from "@/lib/live";
import { qrSvg } from "@/lib/qr-svg";
import { readSettings } from "@/lib/settings";

export const metadata = {
  title: "Group label",
};

export default function BomLabelPage({ params }: { params: Promise<{ id: string }> }) {
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
  const bom = getBom(db, id);
  if (!bom) {
    return (
      <div className="max-w-lg">
        <h1 className="font-heading text-4xl tracking-tight">That group isn’t here</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          It may have been removed, or the address is wrong.
        </p>
        <Link href="/boms" className="mt-5 inline-block text-sm underline underline-offset-4">
          Back to bills of materials
        </Link>
      </div>
    );
  }
  const settings = readSettings(db).values;
  const target = bomLabelTarget(settings.publicUrl, await requestOrigin(), bom.id);
  const svg = await qrSvg(target.url);
  const lines = `${bom.lines.length} ${bom.lines.length === 1 ? "line" : "lines"}`;

  return (
    <article className="label-sheet mx-auto w-full max-w-sm rounded-xl border border-border bg-card px-6 py-8 text-center">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">PartSync</p>
      <h1 className="mt-3 font-heading text-3xl tracking-tight text-balance">{bom.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{lines}</p>
      <div
        className="label-qr mx-auto mt-6 w-fit [&_svg]:h-auto [&_svg]:w-56"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="mt-4 text-sm">Scan to take this group out</p>
      <p className="mt-2 text-xs break-all text-muted-foreground">{target.url}</p>
      {target.warning ? (
        <p className="mt-3 text-sm leading-6 text-low-ink">{target.warning}</p>
      ) : null}
      <div className="no-print mt-6 flex flex-col items-center gap-3">
        <PrintButton label="Print this label" />
        <Link href={`/boms/${bom.id}`} className="text-sm underline underline-offset-4">
          Back to the group
        </Link>
      </div>
    </article>
  );
}
