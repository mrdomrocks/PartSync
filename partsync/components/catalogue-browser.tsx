"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LowMark } from "@/components/low-mark";
import { Input } from "@/components/ui/input";
import { formatQty, isLow } from "@/lib/stock-rules";
import { formatWhen } from "@/lib/time";
import type { ShelfItem } from "@/lib/types";
import { cn } from "cn";

type Filter = "all" | "low" | "plain";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "low", label: "Needs ordering" },
  { id: "plain", label: "No reorder line" },
];

export function CatalogueBrowser({
  items,
  timeZone,
}: {
  items: ShelfItem[];
  timeZone: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const needle = query.trim().toLowerCase();

  const shown = useMemo(() => {
    return items.filter((item) => {
      const low = isLow(item.quantity, item.lowStockAt);
      if (filter === "low" && !low) return false;
      if (filter === "plain" && item.lowStockAt != null) return false;
      if (!needle) return true;
      return [item.name, item.sku, item.category, item.supplier, item.notes]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, needle, filter]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="catalogue-search">
          Search the catalogue
        </label>
        <Input
          id="catalogue-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, SKU, place, or supplier"
          className="h-11 text-base sm:max-w-md"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter items">
          {filters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={filter === entry.id}
              onClick={() => setFilter(entry.id)}
              className={cn(
                "h-10 rounded-full border px-3 text-sm",
                filter === entry.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing matches that filter.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((item) => {
            const low = isLow(item.quantity, item.lowStockAt);
            return (
              <li key={item.id}>
                <Link
                  href={`/items/${item.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {low ? <LowMark /> : null}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {[item.category, item.sku, item.supplier].filter(Boolean).join(" · ") ||
                        "No place or supplier yet"}
                      {item.lastOutAt
                        ? ` · last taken ${formatWhen(item.lastOutAt, timeZone)}`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-heading text-2xl tabular-nums">
                      {formatQty(item.quantity)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.unit}
                      {item.lowStockAt != null
                        ? ` · order at ${formatQty(item.lowStockAt)}`
                        : ""}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
