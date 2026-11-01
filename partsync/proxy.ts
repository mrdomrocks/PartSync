import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionAccount } from "@/lib/accounts";
import { getDb } from "@/lib/db";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();
  // Server actions check the session themselves (see test/auth.test.ts) and redirect in a way the client follows.
  if (request.method === "POST" && request.headers.has("next-action")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token && sessionAccount(getDb(), token)) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (request.method === "GET" && pathname !== "/") {
    login.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(login, 303);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon\\.svg|favicon\\.ico).*)"],
};
