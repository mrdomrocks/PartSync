import Link from "next/link";
import { Suspense } from "react";
import { ItemForm } from "@/components/item-form";
import { LedgerList } from "@/components/ledger-list";
import { LowMark } from "@/components/low-mark";
import { SendReorderButton } from "@/components/mail-actions";
import { PageIntro } from "@/components/page-intro";
import { ShelfSkeleton } from "@/components/shelf-skeleton";
import { TakePanel } from "@/components/take-panel";
import { boardData, suggestions } from "@/lib/inventory";
import { liveDb } from "@/lib/live";
import { readSettings } from "@/lib/settings";
import { formatQty, stockLabel } from "@/lib/stock-rules";
import { formatDay } from "@/lib/time";

export const metadata = {
  title: { absolute: "PartSync" },
};

export default function HomePage() {
  return (
    <Suspense fallback={<ShelfSkeleton title="the board" />}>
      <Board />
    </Suspense>
  );
}

async function Board() {
  const db = await liveDb();
  const settings = readSettings(db).values;
  const board = boardData(db, settings.timeZone);
  const hints = suggestions(db);
  const unsent = board.low.filter((item) => !item.alertActive);

  return (
    <>
      <PageIntro
        eyebrow={formatDay(new Date(), settings.timeZone)}
        title={settings.siteName}
        lede="What’s in stock, what has been taken out, and what needs ordering."
      />

      {board.items.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border bg-card px-5 py-8">
          <h2 className="font-heading text-3xl tracking-tight">The cupboard is empty</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Add what you keep on the shelf, and a reorder line for each. When a count
            falls to that line, PartSync emails once to say it needs ordering.
          </p>
          <div className="mt-5">
            <ItemForm mode="create" hints={hints} />
          </div>
        </section>
      ) : (
        <div className="space-y-8">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="On the catalogue" value={String(board.items.length)} />
            <Stat
              label="Need ordering"
              value={String(board.low.length)}
              tone={board.low.length > 0 ? "low" : "ok"}
            />
            <Stat label="Taken out today" value={String(board.takenToday)} />
          </dl>

          {board.waiting > 0 ? (
            <p className="rounded-xl border border-border bg-low px-4 py-3 text-sm leading-6 text-low-ink">
              {board.waiting === 1
                ? "One reorder email is waiting to be sent."
                : `${board.waiting} reorder emails are waiting to be sent.`}{" "}
              <Link href="/settings" className="underline underline-offset-4">
                Open setup
              </Link>
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-2xl tracking-tight">Needs ordering</h2>
                <Link
                  href="/reorder"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Order list
                </Link>
              </div>
              {board.low.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Everything with a reorder line is still above it.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {board.low.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/items/${item.id}`}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            <LowMark />
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {stockLabel(item.quantity, item.unit)}
                            {item.lowStockAt != null
                              ? ` · reorder at ${formatQty(item.lowStockAt)}`
                              : ""}
                            {item.supplier ? ` · ${item.supplier}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {unsent.length > 0 ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {unsent.length === 1
                    ? "No reorder email has gone out for 1 of these yet."
                    : `No reorder email has gone out for ${unsent.length} of these yet.`}
                </p>
              ) : null}
              {board.unguarded > 0 ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {board.unguarded === 1
                    ? "1 item has no reorder line, so it never sends mail."
                    : `${board.unguarded} items have no reorder line, so they never send mail.`}
                </p>
              ) : null}
              {board.low.length > 0 ? (
                <div className="mt-4">
                  <SendReorderButton />
                </div>
              ) : null}
            </section>
            <TakePanel items={board.items} people={board.people} />
          </div>

          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-heading text-2xl tracking-tight">Latest ledger</h2>
              <Link
                href="/ledger"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                Full ledger
              </Link>
            </div>
            <LedgerList
              movements={board.recent}
              timeZone={settings.timeZone}
              empty="Take something out, book a delivery in, or correct a count, and the line will show up here."
            />
          </section>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "low";
}) {
  return (
    <div
      className={
        tone === "low"
          ? "rounded-xl border border-border bg-low px-4 py-4"
          : "rounded-xl border border-border bg-card px-4 py-4"
      }
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === "low"
            ? "font-heading text-4xl tabular-nums text-low-ink"
            : "font-heading text-4xl tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
