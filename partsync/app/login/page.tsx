import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { accountCount, safeNext } from "@/lib/accounts";
import { currentAccount } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main id="content" className="mx-auto w-full max-w-sm px-4 py-16">
      <p className="font-heading text-4xl tracking-tight text-primary">PartSync</p>
      <Suspense fallback={null}>
        <SignInPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInPanel({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await currentAccount()) redirect(next);

  if (accountCount(getDb()) === 0) {
    return (
      <section className="mt-6 space-y-3 rounded-xl border border-border bg-card p-5 text-sm leading-6">
        <h1 className="font-heading text-2xl tracking-tight">No accounts yet</h1>
        <p className="text-muted-foreground">Create the first one on the Pi, from the PartSync folder:</p>
        <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
          npm run user -- add --email you@example.com --name &quot;Your name&quot;
        </pre>
        <p className="text-muted-foreground">There is no sign-up page. Every account is added from the console.</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h1 className="font-heading text-2xl tracking-tight">Sign in</h1>
      <LoginForm next={next} />
    </section>
  );
}
