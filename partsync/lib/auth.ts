import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionAccount, type Account } from "@/lib/accounts";
import { getDb } from "@/lib/db";

/** Browsers drop Secure cookies on plain http, so this follows the deployment rather than NODE_ENV. */
export function secureCookies(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.PARTSYNC_SECURE_COOKIES ?? "").toLowerCase());
}

export async function currentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sessionAccount(getDb(), token) : null;
}

export async function requireAccount(): Promise<Account> {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return account;
}
