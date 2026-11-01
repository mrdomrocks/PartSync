import { connection } from "next/server";
import { signOutAction } from "@/app/session-actions";
import { requireAccount } from "@/lib/auth";

export async function AccountLine({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  await connection();
  const account = await requireAccount();
  return (
    <form
      action={signOutAction}
      className={
        tone === "paper"
          ? "flex items-center justify-between gap-2 text-xs text-primary-foreground/85"
          : "flex shrink-0 items-center gap-2 text-xs text-muted-foreground"
      }
    >
      <span className="truncate" title={account.email}>
        {account.name || account.email}
      </span>
      <button
        type="submit"
        className={
          tone === "paper"
            ? "shrink-0 rounded-md border border-white/40 px-2 py-1 text-primary-foreground hover:bg-white/15"
            : "shrink-0 rounded-md border border-border px-2 py-1 text-foreground hover:bg-muted"
        }
      >
        Sign out
      </button>
    </form>
  );
}
