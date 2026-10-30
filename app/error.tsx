"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-lg">
      <h1 className="font-heading text-4xl tracking-tight">The shelf book hit a snag</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The count was not changed by this failed step. Try again, and if it keeps happening,
        check the Pi’s logs.
      </p>
      <Button type="button" className="mt-5 h-11 px-4" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
