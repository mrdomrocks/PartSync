import type { MovementKind } from "@/lib/types";

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function isLow(quantity: number, lowStockAt: number | null): boolean {
  return lowStockAt != null && quantity <= lowStockAt;
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 3,
  }).format(roundQty(value));
}

export function movementLine(
  kind: MovementKind,
  amount: number,
  unit: string,
  newQuantity: number,
): string {
  const counted = `${formatQty(kind === "set" ? newQuantity : amount)} ${unit}`;
  if (kind === "out") return `Took ${counted} out of stock`;
  if (kind === "in") return `Booked ${counted} in`;
  return `Set the count to ${counted}`;
}

export function stockLabel(quantity: number, unit: string): string {
  return `${formatQty(quantity)} ${unit} in stock`;
}
