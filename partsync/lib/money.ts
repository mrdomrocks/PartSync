import type { PriceTax } from "@/lib/types";
import { formatQty } from "@/lib/stock-rules";

export function formatMoney(amount: number, currency: string, tax: PriceTax = ""): string {
  const code = currency.trim().toUpperCase();
  let formatted = formatQty(amount);
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      formatted = new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: code,
      }).format(amount);
    } catch {
      formatted = `${formatQty(amount)} ${code}`;
    }
  }
  if (tax === "ex") return `${formatted} ex VAT`;
  if (tax === "inc") return `${formatted} inc VAT`;
  return formatted;
}
