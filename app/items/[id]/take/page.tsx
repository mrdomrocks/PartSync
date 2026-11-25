import Link from "next/link";
import { Suspense } from "react";
import { LowMark } from "@/components/low-mark";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { TakeOut } from "@/components/take-out";
import { getItem, recentPeople } from "@/lib/inventory";
import { itemLabelPath } from "@/lib/labels";
import { liveDb } from "@/lib/live";
import { formatQty, isLow } from "@/lib/stock-rules";

export const metadata = {
  title: "Take out",
};

export default function TakePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the item" />}>
      <TakeScreen params={params} />
    </Suspense>
  );
}

async function TakeScreen({ params }: { params: Promise<{ id: string }> }) {
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
        <Link href="/" className="mt-5 inline-block text-sm underline underline-offset-4">
          Back to parts
        </Link>
      </div>
    );
  }
  const people = recentPeople(db);
  const low = isLow(item.quantity, item.lowStockAt);

  return (
    <div className="max-w-lg">
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href={`/items/${item.id}`} className="underline-offset-4 hover:underline">
          Item details
        </Link>
      </p>
      <PageIntro
        eyebrow={[item.category, item.sku].filter(Boolean).join(" · ") || "Parts"}
        title={item.name}
        lede="Say how many left the shelf, and put your name on the line."
      />
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          {low ? <LowMark /> : null}
          <p className="text-sm text-muted-foreground">In stock</p>
        </div>
        <p className="mb-5 font-heading text-6xl tracking-tight tabular-nums">
          {formatQty(item.quantity)}
          <span className="ml-2 font-sans text-base font-normal text-muted-foreground">
            {item.unit}
          </span>
        </p>
        <TakeOut
          itemId={item.id}
          unit={item.unit}
          quantity={item.quantity}
          people={people}
        />
      </section>
      <p className="mt-4 text-sm">
        <Link href={itemLabelPath(item.id)} className="underline underline-offset-4">
          Print shelf label
        </Link>
      </p>
    </div>
  );
}
