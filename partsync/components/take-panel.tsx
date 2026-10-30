"use client";

import { useMemo, useState } from "react";
import { LowMark } from "@/components/low-mark";
import { MoveForm } from "@/components/move-form";
import { Input } from "@/components/ui/input";
import { formatQty, isLow } from "@/lib/stock-rules";
import type { ShelfItem } from "@/lib/types";

export function TakePanel({
  items,
  people,
}: {
  items: ShelfItem[];
  people: string[];
}) {
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [person, setPerson] = useState("");
  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    const source = needle
      ? items.filter((item) =>
          [item.name, item.sku, item.category, item.supplier]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : items.filter((item) => isLow(item.quantity, item.lowStockAt));
    return source.slice(0, 8);
  }, [items, needle]);

  const picked = items.find((item) => item.id === pickedId) ?? null;

  return (
    <section id="take" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-heading text-2xl tracking-tight">Take out of stock</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Find the thing, say how many left, and put your name on the line.
      </p>
      <div className="mt-4">
        <label htmlFor="shelf-search" className="sr-only">
          Find an item
        </label>
        <Input
          id="shelf-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              event.preventDefault();
              setPickedId(matches[0].id);
            }
          }}
          placeholder="Paper, gloves, coffee…"
          className="h-12 text-base"
          autoComplete="off"
        />
      </div>
      <ul className="mt-3 divide-y divide-border">
        {matches.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">
            {needle ? "Nothing on the catalogue matches that." : "Nothing is low right now. Type a name to take something else out."}
          </li>
        ) : (
          matches.map((item) => {
            const active = item.id === picked?.id;
            const low = isLow(item.quantity, item.lowStockAt);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setPickedId(item.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                  aria-pressed={active}
                >
                  <span>
                    <span className="block font-medium">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[item.category, item.sku].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {low ? <LowMark /> : null}
                    <span className="font-heading text-xl tabular-nums">
                      {formatQty(item.quantity)}
                      <span className="ml-1 font-sans text-xs font-normal text-muted-foreground">
                        {item.unit}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {picked ? (
        <div className="mt-2 border-t border-border pt-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-medium">{picked.name}</h3>
            <button
              type="button"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setPickedId(null)}
            >
              Choose another
            </button>
          </div>
          <MoveForm
            key={picked.id}
            itemId={picked.id}
            kind="out"
            unit={picked.unit}
            quantity={picked.quantity}
            people={people}
            person={person}
            onPerson={setPerson}
          />
        </div>
      ) : null}
    </section>
  );
}
