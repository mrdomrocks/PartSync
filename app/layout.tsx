import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { Suspense } from "react";
import { HostLine } from "@/components/host-line";
import { MobileNav, SideNav } from "@/components/nav";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PartSync",
    template: "%s · PartSync",
  },
  description:
    "Shelf counts, a ledger of what left, and an email when stock is low and needs ordering.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
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
            <div className="mt-auto px-5 pt-4 pb-6">
              <Suspense fallback={null}>
                <HostLine tone="paper" />
              </Suspense>
            </div>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="no-print border-b border-border bg-card px-4 py-3 md:hidden">
              <p className="font-heading text-2xl tracking-tight text-primary">PartSync</p>
              <Suspense fallback={null}>
                <HostLine />
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
      </body>
    </html>
  );
}
