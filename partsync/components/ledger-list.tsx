import { movementLine, formatQty } from "@/lib/stock-rules";
import { formatWhen } from "@/lib/time";
import type { MovementRecord } from "@/lib/types";

export function LedgerList({
  movements,
  timeZone,
  empty,
}: {
  movements: MovementRecord[];
  timeZone: string;
  empty: string;
}) {
  if (movements.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{empty}</p>;
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {movements.map((movement) => {
        const detail = [movement.person, movement.note].filter(Boolean).join(" · ");
        return (
          <li key={movement.id} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{movement.itemName}</p>
              <time
                dateTime={movement.createdAt}
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {formatWhen(movement.createdAt, timeZone)}
              </time>
            </div>
            <p className="mt-1 text-sm">
              {movementLine(
                movement.kind,
                movement.amount,
                movement.itemUnit,
                movement.newQuantity,
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums">
                {formatQty(movement.previousQuantity)} → {formatQty(movement.newQuantity)}{" "}
                {movement.itemUnit}
              </span>
              {detail ? ` · ${detail}` : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
