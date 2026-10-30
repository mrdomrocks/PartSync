"use client";

import { useActionState } from "react";
import { deleteItemAction } from "@/app/actions";
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

export function DeleteItem({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteItemAction, null);
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" className="h-11 px-3 text-destructive" />
        }
      >
        Remove item
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Remove {name}?</DialogTitle>
          <DialogDescription>
            It leaves the catalogue. Ledger lines stay, with the name still on them.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <StatusNote state={state} />
          <Button type="submit" variant="destructive" className="h-11 px-4" disabled={pending}>
            {pending ? "Removing…" : "Remove from the catalogue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
