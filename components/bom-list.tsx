"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { bomLabelSheetPath } from "@/lib/labels";
import type { BomSummary } from "@/lib/types";

export function BomList({ boms }: { boms: BomSummary[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const chosen = boms.filter((bom) => selected.has(bom.id));
  const allShown = boms.length > 0 && boms.every((bom) => selected.has(bom.id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleShown() {
    setSelected((current) => {
      if (allShown) return new Set();
      return new Set(boms.map((bom) => bom.id));
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={allShown}
            onChange={toggleShown}
          />
          Select all
        </label>
        {chosen.length > 0 ? (
          <Link
            href={bomLabelSheetPath(chosen.map((bom) => bom.id))}
            className={buttonVariants({ className: "h-11 px-4" })}
          >
            Print {chosen.length} {chosen.length === 1 ? "QR code" : "QR codes"} on A4
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tick groups to print their codes on one A4 sheet.
          </p>
        )}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {boms.map((bom) => (
          <li key={bom.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={selected.has(bom.id)}
              aria-label={`Select ${bom.name}`}
              onChange={() => toggle(bom.id)}
            />
            <Link href={`/boms/${bom.id}`} className="block min-w-0 flex-1 py-1 hover:bg-muted/60">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{bom.name}</p>
                <span
                  className={
                    bom.short
                      ? "shrink-0 text-xs font-medium tracking-wide text-destructive uppercase"
                      : "shrink-0 text-xs font-medium tracking-wide text-olive uppercase"
                  }
                >
                  {bom.short ? "Short" : "Ready"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {bom.lineCount} {bom.lineCount === 1 ? "line" : "lines"}
                {bom.notes ? ` · ${bom.notes}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
