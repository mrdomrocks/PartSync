"use client";

import { useActionState } from "react";
import { refreshLowPricesAction, refreshPriceAction } from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";

export function RefreshPriceButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(refreshPriceAction, null);
  return (
    <form action={action} className="mt-4 space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="outline" className="h-11 px-4" disabled={pending}>
        {pending ? "Checking the supplier…" : "Refresh price"}
      </Button>
      <StatusNote state={state} />
    </form>
  );
}

export function RefreshPricesButton() {
  const [state, action, pending] = useActionState(refreshLowPricesAction, null);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" className="h-11 px-4" disabled={pending}>
        {pending ? "Checking suppliers…" : "Refresh prices"}
      </Button>
      <StatusNote state={state} />
    </form>
  );
}
