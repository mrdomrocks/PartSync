import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { getItem } from "@/lib/inventory";
import { labelIdList, labelTarget } from "@/lib/labels";
import { liveDb } from "@/lib/live";
import { qrSvg } from "@/lib/qr-svg";
import { readSettings } from "@/lib/settings";

export const metadata = {
  title: "QR sheet",
};

export default function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the labels" />}>
      <Sheet searchParams={searchParams} />
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

async function Sheet({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const params = await searchParams;
  const ids = labelIdList(params.id);
  const db = await liveDb();
  const settings = readSettings(db).values;
  const origin = await requestOrigin();
  const labels = (
    await Promise.all(
      ids.map(async (id) => {
        const item = getItem(db, id);
        if (!item) return null;
        const target = labelTarget(settings.publicUrl, origin, item.id);
        return {
          item,
          warning: target.warning,
          detail: [item.category, item.sku].filter(Boolean).join(" · "),
          svg: await qrSvg(target.url),
        };
      }),
    )
  ).filter((label) => label !== null);
  const warning = labels.find((label) => label.warning)?.warning ?? null;

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">QR sheet</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {labels.length === 0
              ? "No parts were selected."
              : `${labels.length} ${labels.length === 1 ? "code" : "codes"} on A4. Twelve fit on each sheet.`}
          </p>
          {warning ? <p className="mt-2 max-w-xl text-sm leading-6 text-low-ink">{warning}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {labels.length > 0 ? <PrintButton label="Print A4 sheet" /> : null}
          <Link href="/" className="text-sm underline underline-offset-4">
            Back to parts
          </Link>
        </div>
      </div>
      {labels.length > 0 ? (
        <div className="label-grid grid grid-cols-2 gap-4 sm:grid-cols-3">
          {labels.map((label) => (
            <article
              key={label.item.id}
              className="label-cell flex flex-col items-center rounded-lg border border-border bg-card px-3 py-4 text-center"
            >
              <h2 className="line-clamp-2 text-sm font-medium text-balance">{label.item.name}</h2>
              {label.detail ? (
                <p className="mt-1 w-full truncate text-xs text-muted-foreground">{label.detail}</p>
              ) : null}
              <div
                className="mt-3 w-28 [&_svg]:h-auto [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: label.svg }}
              />
              <p className="mt-2 text-xs text-muted-foreground">Scan to take from stock</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
