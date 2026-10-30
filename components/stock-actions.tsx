"use client";

import { useState } from "react";
import { MoveForm } from "@/components/move-form";
import type { MovementKind, ShelfItem } from "@/lib/types";
import { cn } from "cn";

const kinds: { id: MovementKind; label: string }[] = [
  { id: "out", label: "Take out" },
  { id: "in", label: "Book in" },
  { id: "set", label: "Correct count" },
];

export function StockActions({
  item,
  people,
}: {
  item: ShelfItem;
  people: string[];
}) {
  const [kind, setKind] = useState<MovementKind>("out");
  const [person, setPerson] = useState("");
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 grid grid-cols-3 gap-2" role="group" aria-label="Kind of stock change">
        {kinds.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={kind === entry.id}
            onClick={() => setKind(entry.id)}
            className={cn(
              "h-11 rounded-lg border px-2 text-sm",
              kind === entry.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <MoveForm
        key={kind}
        itemId={item.id}
        kind={kind}
        unit={item.unit}
        quantity={item.quantity}
        people={people}
        person={person}
        onPerson={setPerson}
      />
    </section>
  );
}
