import Link from "next/link";
import { Suspense } from "react";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { TakeOut } from "@/components/take-out";
import { getItem, recentPeople } from "@/lib/inventory";
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
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
        <h1 className="font-heading text-3xl tracking-tight">That item isn’t on the shelf</h1>
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
  const detail = [item.category, item.sku].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:min-h-0 md:px-0 md:pt-0">
      <p className="text-sm font-medium text-primary md:hidden">PartSync</p>
      <h1 className="mt-3 font-heading text-3xl leading-tight tracking-tight text-balance break-words">
        {item.name}
      </h1>
      {detail ? <p className="mt-1 text-sm break-words text-muted-foreground">{detail}</p> : null}
      <p className="mt-4 font-heading text-5xl tracking-tight tabular-nums">
        {formatQty(item.quantity)}
        <span className="ml-2 font-sans text-base font-normal text-muted-foreground">{item.unit}</span>
      </p>
      {low ? <p className="mt-2 text-sm text-low-ink">On the reorder line</p> : null}
      <div className="mt-6 flex flex-1 flex-col">
        <TakeOut itemId={item.id} unit={item.unit} quantity={item.quantity} people={people} />
      </div>
      <p className="mt-4 text-center text-sm">
        <Link href={`/items/${item.id}`} className="text-muted-foreground underline underline-offset-4">
          Item details
        </Link>
      </p>
    </div>
  );
}
