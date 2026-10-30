"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutGrid,
  Package,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "cn";

const links = [
  {
    href: "/",
    label: "Board",
    icon: LayoutGrid,
    current: (pathname: string) => pathname === "/",
  },
  {
    href: "/catalogue",
    label: "Items",
    icon: Package,
    current: (pathname: string) =>
      pathname.startsWith("/catalogue") || pathname.startsWith("/items"),
  },
  {
    href: "/ledger",
    label: "Ledger",
    icon: ScrollText,
    current: (pathname: string) => pathname.startsWith("/ledger"),
  },
  {
    href: "/reorder",
    label: "Order",
    icon: ClipboardList,
    current: (pathname: string) => pathname.startsWith("/reorder"),
  },
  {
    href: "/settings",
    label: "Setup",
    icon: SettingsIcon,
    current: (pathname: string) => pathname.startsWith("/settings"),
  },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="flex flex-1 flex-col gap-1 px-3">
      {links.map((link) => {
        const active = link.current(pathname);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-[#f4ecdf]/80 transition-colors hover:bg-white/10 hover:text-[#f4ecdf]",
              active && "bg-white/10 font-medium text-[#f4ecdf]",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-[#3a3228] bg-[#2a241c] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {links.map((link) => {
          const active = link.current(pathname);
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-[#d7cbb8]",
                  active && "text-[#f6efe4]",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
