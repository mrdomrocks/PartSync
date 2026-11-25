import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
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
  appleWebApp: {
    capable: true,
    title: "PartSync",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c4bdd",
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
        <Suspense fallback={null}>
          <AppShell
            sidebar={
              <>
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
              </>
            }
            mobileHeader={
              <>
                <p className="font-heading text-2xl tracking-tight text-primary">PartSync</p>
                <Suspense fallback={null}>
                  <HostLine />
                </Suspense>
              </>
            }
            mobileNav={
              <Suspense fallback={null}>
                <MobileNav />
              </Suspense>
            }
          >
            {children}
          </AppShell>
        </Suspense>
      </body>
    </html>
  );
}
