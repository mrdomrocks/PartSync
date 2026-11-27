import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { DeleteItem } from "@/components/delete-item";
import { Button } from "@/components/ui/button";
import { ItemForm } from "@/components/item-form";
import { RefreshPriceButton } from "@/components/price-actions";
import { LedgerList } from "@/components/ledger-list";
import { LowMark } from "@/components/low-mark";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { StockActions } from "@/components/stock-actions";
import {
  getItem,
  latestItemMessage,
  listMovements,
  recentPeople,
  suggestions,
} from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { readSettings } from "@/lib/settings";
import { itemLabelPath } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { formatQty, isLow } from "@/lib/stock-rules";
import { supplierPage } from "@/lib/suppliers";
import { formatWhen } from "@/lib/time";

export const metadata = {
  title: "Item",
};

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the item" />}>
      <ItemScreen params={params} />
    </Suspense>
  );
}

async function ItemScreen({ params }: { params: Promise<{ id: string }> }) {
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
  const movements = listMovements(db, { itemId: item.id, limit: 40 });
  const people = recentPeople(db);
  const hints = suggestions(db);
  const low = isLow(item.quantity, item.lowStockAt);
  const message = latestItemMessage(db, item.id);
  const mailNote = low ? mailCopy(item.alertActive, message, settings.timeZone) : null;
  const page = supplierPage(item);
  const canPrice = Boolean(item.productUrl || (item.sku && item.supplier));

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/catalogue" className="underline-offset-4 hover:underline">
          Catalogue
        </Link>
      </p>
      <PageIntro
        eyebrow={[item.category, item.sku].filter(Boolean).join(" · ") || "Catalogue"}
        title={item.name}
        lede={item.supplier ? `Order from ${item.supplier}.` : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            {low ? <LowMark /> : null}
            <p className="text-sm text-muted-foreground">In stock</p>
          </div>
          <p className="font-heading text-6xl tracking-tight tabular-nums">
            {formatQty(item.quantity)}
          </p>
          <p className="text-sm text-muted-foreground">{item.unit}</p>
          <dl className="mt-5 space-y-2 text-sm">
            <Row
              label="Reorder at"
              value={
                item.lowStockAt == null
                  ? "No email"
                  : `${formatQty(item.lowStockAt)} ${item.unit}`
              }
            />
            <Row label="SKU" value={item.sku || "—"} />
            <Row
              label="Supplier"
              value={
                page ? (
                  <a
                    href={page.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {item.supplier || "Product page"}
                  </a>
                ) : (
                  item.supplier || "—"
                )
              }
            />
            <Row
              label="Price"
              value={
                item.priceAmount == null
                  ? "—"
                  : formatMoney(item.priceAmount, item.priceCurrency, item.priceTax)
              }
            />
          </dl>
          {item.priceCheckedAt || item.priceDetail ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {item.priceCheckedAt
                ? `Checked ${formatWhen(item.priceCheckedAt, settings.timeZone)}.`
                : ""}
              {item.priceDetail ? ` ${item.priceDetail}` : ""}
            </p>
          ) : null}
          {canPrice ? <RefreshPriceButton id={item.id} /> : null}
          {item.notes ? <p className="mt-4 text-sm leading-6">{item.notes}</p> : null}
          {mailNote ? (
            <p className="mt-4 text-sm leading-6 text-low-ink">{mailNote}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <ItemForm mode="edit" item={item} hints={hints} />
            <Button
              variant="outline"
              className="h-11 px-4"
              render={<Link href={itemLabelPath(item.id)} />}
            >
              Print shelf label
            </Button>
            <Button variant="outline" className="h-11 px-4" render={<Link href="/scan" />}>
              Scan a label
            </Button>
            <DeleteItem id={item.id} name={item.name} />
          </div>
        </section>
        <StockActions item={item} people={people} />
      </div>
      <section className="mt-8">
        <h2 className="mb-3 font-heading text-2xl tracking-tight">This item’s ledger</h2>
        <LedgerList
          movements={movements}
          timeZone={settings.timeZone}
          empty="No changes have been logged for this item yet."
        />
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function mailCopy(
  alertActive: boolean,
  message: { status: string; detail: string; sentAt: string | null; createdAt: string } | null,
  timeZone: string,
): string | null {
  if (!message || message.status === "cancelled") {
    return alertActive ? null : "On the reorder line, and no email has been sent for it yet.";
  }
  if (message.status === "sent") {
    return `Reorder email sent ${formatWhen(message.sentAt ?? message.createdAt, timeZone)}.`;
  }
  if (message.status === "failed") {
    return `Reorder email didn’t go out. ${message.detail}`;
  }
  if (message.status === "held") {
    return message.detail
      ? `Reorder email is waiting in Setup. ${message.detail}`
      : "Reorder email is waiting in Setup.";
  }
  return null;
}
