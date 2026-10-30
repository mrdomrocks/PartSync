"use client";

import { useActionState } from "react";
import { deleteBomAction } from "@/app/actions";
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

export function DeleteBom({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteBomAction, null);
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" className="h-11 px-3 text-destructive" />
        }
      >
        Remove group
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Remove {name}?</DialogTitle>
          <DialogDescription>
            The group goes. Stock already taken stays taken, and the ledger keeps those lines.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <StatusNote state={state} />
          <Button type="submit" variant="destructive" className="h-11 px-4" disabled={pending}>
            {pending ? "Removing…" : "Remove this group"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
