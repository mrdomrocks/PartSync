"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, endSession, safeNext, signIn } from "@/lib/accounts";
import { secureCookies } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { ActionState } from "@/lib/types";

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const outcome = signIn(
    getDb(),
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!outcome.ok) {
    return {
      ok: false,
      error:
        outcome.reason === "locked"
          ? "Too many wrong passwords. Wait 15 minutes and try again."
          : "That email and password do not match.",
    };
  }
  (await cookies()).set(SESSION_COOKIE, outcome.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    expires: new Date(outcome.expiresAt),
  });
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function signOutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) endSession(getDb(), token);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
