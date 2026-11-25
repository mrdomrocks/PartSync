"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print this list" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="no-print h-11 px-4"
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}
