import { Suspense } from "react";
import { AccountLine } from "@/components/account-line";
import { HostLine } from "@/components/host-line";
import { MobileNav, SideNav } from "@/components/nav";

export default function ShelfLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="min-h-full md:flex">
        <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-primary text-primary-foreground md:flex">
          <div className="px-5 pt-7 pb-6">
            <p className="font-heading text-3xl tracking-tight">PartSync</p>
            <p className="mt-1 text-xs leading-5 text-primary-foreground/75">
              Counts, a ledger, and a reorder email.
            </p>
          </div>
          <Suspense fallback={<div className="flex-1" />}>
            <SideNav />
          </Suspense>
          <div className="mt-auto space-y-3 px-5 pt-4 pb-6">
            <Suspense fallback={null}>
              <AccountLine tone="paper" />
            </Suspense>
            <Suspense fallback={null}>
              <HostLine tone="paper" />
            </Suspense>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="no-print flex items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
            <div className="min-w-0">
              <p className="font-heading text-2xl tracking-tight text-primary">PartSync</p>
              <Suspense fallback={null}>
                <HostLine />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <AccountLine />
            </Suspense>
          </header>
          <main
            id="content"
            className="mx-auto w-full max-w-5xl px-4 py-6 pb-28 md:px-10 md:py-10 md:pb-16"
          >
            {children}
          </main>
        </div>
      </div>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </>
  );
}
