import Link from "next/link";
import { Suspense } from "react";
import { BomCheckout } from "@/components/bom-checkout";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { getBom, recentPeople } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { bomBlockedCopy, formatQty } from "@/lib/stock-rules";

export const metadata = {
  title: "Take a group out",
};

export default function TakeBomPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the group" />}>
      <TakeBom params={params} />
    </Suspense>
  );
}

async function TakeBom({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await liveDb();
  const bom = getBom(db, id);
  if (!bom) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
        <h1 className="font-heading text-3xl tracking-tight">That group isn’t here</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          It may have been removed, or the address is wrong.
        </p>
        <Link href="/boms" className="mt-5 inline-block text-sm underline underline-offset-4">
          Back to bills of materials
        </Link>
      </div>
    );
  }
  const people = recentPeople(db);
  const blocked = bomBlockedCopy(bom.lines);
  const ready = bom.lines.length > 0 && blocked === "";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:min-h-0 md:px-0 md:pt-0">
      <p className="text-sm font-medium text-primary md:hidden">PartSync</p>
      <h1 className="mt-3 font-heading text-3xl leading-tight tracking-tight text-balance break-words">
        {bom.name}
      </h1>
      {bom.notes ? <p className="mt-1 text-sm break-words text-muted-foreground">{bom.notes}</p> : null}
      {bom.lines.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This group has no lines left in the catalogue.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {bom.lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 break-words">{line.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatQty(line.quantity)} {line.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Every line leaves together. If one is short, nothing is taken.
      </p>
      <div className="mt-4 flex flex-1 flex-col">
        <BomCheckout bomId={bom.id} ready={ready} blocked={blocked} people={people} compact />
      </div>
      <p className="mt-4 text-center text-sm">
        <Link href={`/boms/${bom.id}`} className="text-muted-foreground underline underline-offset-4">
          Group details
        </Link>
      </p>
    </div>
  );
}
