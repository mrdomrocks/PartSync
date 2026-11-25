"use client";

import { useActionState, useState } from "react";
import { moveAction } from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQty, stockLabel } from "@/lib/stock-rules";
import type { ActionState, MovementKind } from "@/lib/types";

const copy: Record<
  MovementKind,
  { amount: string; person: string; note: string; submit: string; placeholder: string }
> = {
  out: {
    amount: "How many left the shelf",
    person: "Your name",
    note: "Note",
    submit: "Take out of stock",
    placeholder: "Where it went",
  },
  in: {
    amount: "How many came in",
    person: "Booked in by",
    note: "Note",
    submit: "Book into stock",
    placeholder: "Delivery or a return",
  },
  set: {
    amount: "Count on the shelf now",
    person: "Counted by",
    note: "Note",
    submit: "Save the count",
    placeholder: "What you found",
  },
};

export function MoveForm({
  itemId,
  kind,
  unit,
  quantity,
  people,
  person,
  onPerson,
  focusPerson = false,
  compact = false,
}: {
  itemId: string;
  kind: MovementKind;
  unit: string;
  quantity: number;
  people: string[];
  person: string;
  onPerson: (person: string) => void;
  focusPerson?: boolean;
  compact?: boolean;
}) {
  const [state, submit, pending] = useActionState(moveAction, null);
  const [amount, setAmount] = useState(kind === "set" ? String(quantity) : "1");
  const [note, setNote] = useState("");
  const [seen, setSeen] = useState<ActionState>(null);
  const text = copy[kind];
  const listId = `${itemId}-${kind}-people`;

  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      if (kind !== "set") setAmount("1");
      setNote("");
    }
  }

  const amountField = (
    <div className="space-y-1.5">
      <Label htmlFor={`${listId}-amount`}>{text.amount}</Label>
      <Input
        id={`${listId}-amount`}
        name="amount"
        required
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="h-12 text-lg tabular-nums"
        autoComplete="off"
      />
    </div>
  );
  const personField = (
    <div className="space-y-1.5">
      <Label htmlFor={`${listId}-person`}>
        {text.person}
        {kind === "out" ? "" : " (optional)"}
      </Label>
      <Input
        id={`${listId}-person`}
        name="person"
        required={kind === "out"}
        value={person}
        onChange={(event) => onPerson(event.target.value)}
        list={listId}
        maxLength={80}
        className="h-12 text-base"
        autoComplete="name"
        autoFocus={focusPerson}
      />
      <datalist id={listId}>
        {people.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
  const noteField = compact ? (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">Add a note</summary>
      <Input
        id={`${listId}-note`}
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={text.placeholder}
        maxLength={500}
        className="mt-2 h-12 text-base"
        autoComplete="off"
      />
    </details>
  ) : (
    <div className="space-y-1.5">
      <Label htmlFor={`${listId}-note`}>{text.note}</Label>
      <Input
        id={`${listId}-note`}
        name="note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={text.placeholder}
        maxLength={500}
        className="h-11 text-base"
        autoComplete="off"
      />
    </div>
  );

  return (
    <form action={submit} className={compact ? "flex flex-1 flex-col gap-4" : "space-y-3"}>
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="kind" value={kind} />
      {compact ? null : (
        <p className="text-sm text-muted-foreground">{stockLabel(quantity, unit)}</p>
      )}
      <StatusNote state={state} />
      {compact ? personField : amountField}
      {compact ? amountField : personField}
      {noteField}
      <div className={compact ? "mt-auto pt-2" : undefined}>
        <Button
          type="submit"
          className={compact ? "h-14 w-full text-base" : "h-12 px-4 text-base"}
          disabled={pending}
        >
          {pending ? "Saving the ledger…" : text.submit}
        </Button>
      </div>
      {kind === "out" && quantity > 0 && !compact ? (
        <p className="text-xs text-muted-foreground">
          Up to {formatQty(quantity)} {unit} can leave.
        </p>
      ) : null}
    </form>
  );
}
