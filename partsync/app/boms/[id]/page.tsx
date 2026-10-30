import Link from "next/link";
import { Suspense } from "react";
import { BomCheckout } from "@/components/bom-checkout";
import { BomEditor } from "@/components/bom-editor";
import { DeleteBom } from "@/components/delete-bom";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { getBom, listItems, recentPeople } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { formatQty, stockLabel } from "@/lib/stock-rules";
import { cn } from "cn";

export const metadata = {
  title: "BoM",
};

export default function BomPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the group" />}>
      <BomScreen params={params} />
    </Suspense>
  );
}

function blockedCopy(
  lines: { name: string; quantity: number; inStock: number }[],
): string {
  const shortages = lines
    .filter((line) => line.quantity > line.inStock)
    .map((line) => {
      const verb = line.inStock === 1 ? "is" : "are";
      return `${line.name} needs ${formatQty(line.quantity)} and ${formatQty(line.inStock)} ${verb} in stock`;
    });
  if (shortages.length === 0) return "";
  return `This group has to leave together. ${shortages.join(". ")}.`;
}

async function BomScreen({ params }: { params: Promise<{ id: string }> }) {
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
  const items = listItems(db);
  const people = recentPeople(db);
  const blocked = blockedCopy(bom.lines);
  const ready = bom.lines.length > 0 && blocked === "";

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        <Link href="/boms" className="underline-offset-4 hover:underline">
          Bills of materials
        </Link>
      </p>
      <PageIntro eyebrow="Bill of materials" title={bom.name} lede={bom.notes || undefined} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-medium">Lines</h2>
          </div>
          {bom.lines.length === 0 ? (
            <p className="px-4 py-3 text-sm leading-6 text-muted-foreground">
              Every line on this group has left the catalogue. Add lines again below.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {bom.lines.map((line) => {
                const short = line.quantity > line.inStock;
                return (
                  <li key={line.id} className={cn("px-4 py-3", short && "bg-low")}>
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/items/${line.itemId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {line.name}
                      </Link>
                      {short ? (
                        <span className="shrink-0 text-xs font-medium tracking-wide text-low-ink uppercase">
                          Short
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm">
                      Take {formatQty(line.quantity)} {line.unit}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {stockLabel(line.inStock, line.unit)}
                      {line.sku ? ` · ${line.sku}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-3 font-medium">Check out</h2>
          {bom.lines.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Add at least one catalogue line before this group can leave.
            </p>
          ) : (
            <BomCheckout bomId={bom.id} ready={ready} blocked={blocked} people={people} />
          )}
        </section>
      </div>
      <section className="mt-10">
        <h2 className="mb-4 font-heading text-2xl tracking-tight">Change the lines</h2>
        <BomEditor items={items} bom={bom} />
      </section>
      <div className="mt-8">
        <DeleteBom id={bom.id} name={bom.name} />
      </div>
    </>
  );
}
