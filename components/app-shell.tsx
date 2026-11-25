"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isHandheldFlow } from "@/lib/flow";

export function AppShell({
  sidebar,
  mobileHeader,
  mobileNav,
  children,
}: {
  sidebar: ReactNode;
  mobileHeader: ReactNode;
  mobileNav: ReactNode;
  children: ReactNode;
}) {
  const focused = isHandheldFlow(usePathname() || "/");
  return (
    <div className="min-h-full md:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-primary text-primary-foreground md:flex">
        {sidebar}
      </aside>
      <div className="min-w-0 flex-1">
        {focused ? null : (
          <header className="no-print border-b border-border bg-card px-4 py-3 md:hidden">
            {mobileHeader}
          </header>
        )}
        <main
          id="content"
          className={
            focused
              ? "mx-auto w-full max-w-5xl md:px-10 md:py-10"
              : "mx-auto w-full max-w-5xl px-4 py-6 pb-28 md:px-10 md:py-10 md:pb-16"
          }
        >
          {children}
        </main>
      </div>
      {focused ? null : mobileNav}
    </div>
  );
}
