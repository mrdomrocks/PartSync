"use client";

import { useActionState } from "react";
import {
  discardMessageAction,
  sendDigestAction,
  sendPendingAction,
  sendTestAction,
} from "@/app/actions";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";

export function SendReorderButton() {
  const [state, action, pending] = useActionState(sendDigestAction, null);
  return (
    <form action={action} className="no-print space-y-2">
      <Button type="submit" className="h-11 px-4" disabled={pending}>
        {pending ? "Preparing the email…" : "Email the order list"}
      </Button>
      <StatusNote state={state} />
    </form>
  );
}

export function SendPendingButton() {
  const [state, action, pending] = useActionState(sendPendingAction, null);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" className="h-11 px-4" disabled={pending}>
        {pending ? "Sending…" : "Send waiting mail"}
      </Button>
      <StatusNote state={state} />
    </form>
  );
}

export function SendTestButton() {
  const [state, action, pending] = useActionState(sendTestAction, null);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" className="h-11 px-4" disabled={pending}>
        {pending ? "Sending the test…" : "Send a test email"}
      </Button>
      <StatusNote state={state} />
    </form>
  );
}

export function DiscardButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(discardMessageAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Discarding…" : "Discard"}
      </Button>
      <StatusNote state={state} />
    </form>
  );
}
