import Link from "next/link";
import { Suspense } from "react";
import { SendReorderButton } from "@/components/mail-actions";
import { PageIntro } from "@/components/page-intro";
import { PrintButton } from "@/components/print-button";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { lowItems } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { readSettings } from "@/lib/settings";
import { formatQty } from "@/lib/stock-rules";
import { formatDay } from "@/lib/time";

export const metadata = {
  title: "Order list",
};

export default function ReorderPage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="the order list" />}>
      <Reorder />
    </Suspense>
  );
}

async function Reorder() {
  const db = await liveDb();
  const settings = readSettings(db).values;
  const items = lowItems(db);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageIntro
          className="mb-0"
          eyebrow={formatDay(new Date(), settings.timeZone)}
          title="Order list"
          lede={`${settings.siteName}. Items at or below their reorder line.`}
        />
        <div className="no-print mb-8 flex flex-wrap gap-2">
          <PrintButton />
          <SendReorderButton />
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Nothing needs ordering.{" "}
          <Link href="/" className="underline underline-offset-4">
            Back to the board
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">Items that need ordering</caption>
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">In stock</th>
                <th className="px-4 py-3 font-medium">Reorder at</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Order</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {[item.sku, item.category].filter(Boolean).join(" · ")}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatQty(item.quantity)} {item.unit}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.lowStockAt == null ? "—" : `${formatQty(item.lowStockAt)} ${item.unit}`}
                  </td>
                  <td className="px-4 py-3">{item.supplier || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">__________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
