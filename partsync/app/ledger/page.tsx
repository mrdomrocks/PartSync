import { Suspense } from "react";
import { LedgerList } from "@/components/ledger-list";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listMovements } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { readSettings } from "@/lib/settings";
import type { MovementKind } from "@/lib/types";

export const metadata = {
  title: "Ledger",
};

export default function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  return (
    <Suspense fallback={<ShelfSkeleton title="the ledger" />}>
      <Ledger searchParams={searchParams} />
    </Suspense>
  );
}

function asKind(value: string | undefined): MovementKind | "" {
  if (value === "out" || value === "in" || value === "set") return value;
  return "";
}

async function Ledger({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const db = await liveDb();
  const settings = readSettings(db).values;
  const query = (params.q ?? "").slice(0, 80);
  const kind = asKind(params.kind);
  const movements = listMovements(db, { query, kind, limit: 300 });

  return (
    <>
      <PageIntro
        eyebrow="What changed"
        title="Ledger"
        lede="Every take-out, delivery, and corrected count. Removing an item keeps its lines."
      />
      <form action="/ledger" className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="ledger-q">
          Search the ledger
        </label>
        <Input
          id="ledger-q"
          name="q"
          defaultValue={query}
          placeholder="Item, person, or note"
          className="h-11 text-base sm:max-w-xs"
        />
        <label className="sr-only" htmlFor="ledger-kind">
          Kind of entry
        </label>
        <select
          id="ledger-kind"
          name="kind"
          defaultValue={kind}
          className="h-11 rounded-lg border border-input bg-transparent px-2.5 text-base"
        >
          <option value="">All entries</option>
          <option value="out">Taken out</option>
          <option value="in">Booked in</option>
          <option value="set">Counts</option>
        </select>
        <Button type="submit" variant="outline" className="h-11 px-4">
          Show
        </Button>
      </form>
      <LedgerList
        movements={movements}
        timeZone={settings.timeZone}
        empty="Nothing in the ledger matches that."
      />
      {movements.length === 300 ? (
        <p className="mt-3 text-xs text-muted-foreground">Showing the latest 300 lines.</p>
      ) : null}
    </>
  );
}
