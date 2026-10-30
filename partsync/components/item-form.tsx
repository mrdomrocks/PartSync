"use client";

import { useActionState, type ReactNode } from "react";
import { createItemAction, updateItemAction } from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatQty } from "@/lib/stock-rules";
import type { ShelfItem } from "@/lib/types";

type Hints = {
  categories: string[];
  units: string[];
  suppliers: string[];
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ItemForm({
  mode,
  item,
  hints,
}: {
  mode: "create" | "edit";
  item?: ShelfItem;
  hints: Hints;
}) {
  const action = mode === "create" ? createItemAction : updateItemAction;
  const [state, formAction, pending] = useActionState(action, null);
  const listPrefix = item?.id ?? "new";

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={mode === "create" ? "default" : "outline"}
            className="h-11 px-4"
          />
        }
      >
        {mode === "create" ? "Add an item" : "Edit details"}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            {mode === "create" ? "Add to the catalogue" : `Edit ${item?.name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "A name, how you count it, and the line where it needs ordering."
              : "The count itself is changed from the stock buttons, so the ledger keeps the reason."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {item ? <input type="hidden" name="id" value={item.id} /> : null}
          <StatusNote state={state} />
          <Field label="Name">
            <Input
              name="name"
              required
              defaultValue={item?.name ?? ""}
              maxLength={120}
              className="h-11 text-base"
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Where it lives" hint="Shelf, cupboard, or room.">
              <Input
                name="category"
                defaultValue={item?.category ?? ""}
                list={`${listPrefix}-categories`}
                maxLength={60}
                className="h-11 text-base"
                autoComplete="off"
              />
              <datalist id={`${listPrefix}-categories`}>
                {hints.categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
            <Field label="Unit" hint="reams, boxes, kg, each.">
              <Input
                name="unit"
                required
                defaultValue={item?.unit ?? "each"}
                list={`${listPrefix}-units`}
                maxLength={30}
                className="h-11 text-base"
                autoComplete="off"
              />
              <datalist id={`${listPrefix}-units`}>
                {hints.units.map((unit) => (
                  <option key={unit} value={unit} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" hint="Optional.">
              <Input
                name="sku"
                defaultValue={item?.sku ?? ""}
                maxLength={60}
                className="h-11 text-base"
                autoComplete="off"
              />
            </Field>
            <Field label="Supplier" hint="Who you order it from.">
              <Input
                name="supplier"
                defaultValue={item?.supplier ?? ""}
                list={`${listPrefix}-suppliers`}
                maxLength={120}
                className="h-11 text-base"
                autoComplete="off"
              />
              <datalist id={`${listPrefix}-suppliers`}>
                {hints.suppliers.map((supplier) => (
                  <option key={supplier} value={supplier} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "create" ? (
              <Field label="Opening count">
                <Input
                  name="quantity"
                  required
                  inputMode="decimal"
                  defaultValue="0"
                  className="h-11 text-base tabular-nums"
                  autoComplete="off"
                />
              </Field>
            ) : (
              <Field label="In stock now">
                <p className="flex h-11 items-center text-sm tabular-nums">
                  {item ? `${formatQty(item.quantity)} ${item.unit}` : "—"}
                </p>
              </Field>
            )}
            <Field
              label="Reorder at"
              hint="Email once when the count is at or below this. Leave blank to skip email."
            >
              <Input
                name="lowStockAt"
                inputMode="decimal"
                defaultValue={item?.lowStockAt ?? ""}
                placeholder="No email"
                className="h-11 text-base tabular-nums"
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label="Note" hint="Optional. Shown on the order email.">
            <Textarea
              name="notes"
              defaultValue={item?.notes ?? ""}
              maxLength={500}
              className="text-base"
            />
          </Field>
          <Button type="submit" className="h-11 px-4" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Add the item" : "Save details"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
