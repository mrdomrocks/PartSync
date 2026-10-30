"use client";

import { useActionState, useState } from "react";
import { checkOutBomAction } from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/types";

export function BomCheckout({
  bomId,
  ready,
  blocked,
  people,
}: {
  bomId: string;
  ready: boolean;
  blocked: string;
  people: string[];
}) {
  const [state, action, pending] = useActionState(checkOutBomAction, null);
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const [seen, setSeen] = useState<ActionState>(null);
  const listId = `${bomId}-people`;

  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setNote("");
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="bomId" value={bomId} />
      <StatusNote state={state} />
      {blocked ? (
        <p role="alert" className="text-sm leading-6 text-destructive">
          {blocked}
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          Every line leaves together. If one is short, nothing is taken.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${listId}-person`}>Your name</Label>
        <Input
          id={`${listId}-person`}
          name="person"
          required
          value={person}
          onChange={(event) => setPerson(event.target.value)}
          list={listId}
          maxLength={80}
          className="h-11 text-base"
          autoComplete="name"
        />
        <datalist id={listId}>
          {people.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${listId}-note`}>Note</Label>
        <Input
          id={`${listId}-note`}
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Job or where it went"
          maxLength={500}
          className="h-11 text-base"
          autoComplete="off"
        />
      </div>
      <Button type="submit" className="h-12 px-4 text-base" disabled={pending || !ready}>
        {pending ? "Taking the group out…" : "Take this group out"}
      </Button>
    </form>
  );
}
