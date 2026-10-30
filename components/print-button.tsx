"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      className="no-print h-11 px-4"
      onClick={() => window.print()}
    >
      Print this list
    </Button>
  );
}
