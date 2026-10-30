"use client";

import { useActionState, useState } from "react";
import { createBomAction, updateBomAction } from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { stockLabel } from "@/lib/stock-rules";
import type { Bom, ShelfItem } from "@/lib/types";

export function BomEditor({ items, bom }: { items: ShelfItem[]; bom?: Bom }) {
  const [state, action, pending] = useActionState(
    bom ? updateBomAction : createBomAction,
    null,
  );
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const line of bom?.lines ?? []) initial[line.itemId] = String(line.quantity);
    return initial;
  });
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter((item) =>
        [item.name, item.sku, item.category].join(" ").toLowerCase().includes(needle),
      )
    : items;
  const chosen = items.filter((item) => item.id in picked);
  const quantitiesReady = chosen.every((item) => {
    const raw = (picked[item.id] ?? "").trim().replace(",", ".");
    return /^\d+(\.\d+)?$/.test(raw) && Number(raw) > 0;
  });

  function toggle(id: string) {
    setPicked((current) => {
      const next = { ...current };
      if (id in next) delete next[id];
      else next[id] = "1";
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="max-w-lg text-sm leading-6 text-muted-foreground">
        Add items to the catalogue first. A group is made from those lines.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {bom ? <input type="hidden" name="id" value={bom.id} /> : null}
      {chosen.map((item) => (
        <input key={item.id} type="hidden" name="line" value={`${item.id}|${picked[item.id]}`} />
      ))}
      <StatusNote state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="bom-name">Group name</Label>
        <Input
          id="bom-name"
          name="name"
          required
          defaultValue={bom?.name ?? ""}
          maxLength={120}
          className="h-12 text-lg"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bom-notes">Note</Label>
        <Textarea
          id="bom-notes"
          name="notes"
          defaultValue={bom?.notes ?? ""}
          maxLength={500}
          placeholder="Where this group is used"
        />
      </div>
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-medium">In this group</h2>
          <p className="text-sm text-muted-foreground">
            {chosen.length === 0
              ? "Tick lines below. They leave the shelf together."
              : `${chosen.length} ${chosen.length === 1 ? "line" : "lines"}`}
          </p>
        </div>
        {chosen.length > 0 ? (
          <ul className="divide-y divide-border">
            {chosen.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {stockLabel(item.quantity, item.unit)}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`qty-${item.id}`}>
                  Quantity of {item.name}
                </label>
                <Input
                  id={`qty-${item.id}`}
                  inputMode="decimal"
                  value={picked[item.id]}
                  onChange={(event) =>
                    setPicked((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                  className="h-11 w-24 text-base tabular-nums"
                  autoComplete="off"
                />
                <span className="shrink-0 text-sm text-muted-foreground">{item.unit}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <div className="space-y-1.5">
        <Label htmlFor="bom-search">Catalogue</Label>
        <Input
          id="bom-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or SKU"
          className="h-11"
          autoComplete="off"
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in the catalogue matches that.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
          {visible.map((item) => {
            const checked = item.id in picked;
            return (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                    className="size-4 accent-primary"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[item.sku, stockLabel(item.quantity, item.unit)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        type="submit"
        className="h-12 px-4 text-base"
        disabled={pending || chosen.length === 0 || !quantitiesReady}
      >
        {pending ? "Saving…" : bom ? "Save group" : "Save this group"}
      </Button>
      {chosen.length > 0 && !quantitiesReady ? (
        <p className="text-sm text-muted-foreground">Each line needs a quantity above zero.</p>
      ) : null}
    </form>
  );
}
