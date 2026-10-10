import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (the former `middleware.ts`). Runs on every matched request
 * and does two jobs:
 *
 *   1. Refreshes the Supabase session cookies. Access tokens are short-lived,
 *      so without this a user would be logged out mid-session and Server
 *      Components (which cannot write cookies) could not fix it.
 *   2. Coarse route protection: bounce anonymous visitors to /login and signed
 *      in users away from /login.
 *
 * This is a convenience layer, not the security boundary. Every page and route
 * handler re-checks the session itself, and the database enforces tenancy via
 * RLS. A proxy-only check would be unsafe on its own.
 */

const PUBLIC_PATHS = ["/login", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there is no session to refresh. Let the request
  // through so the app can render its own "not configured" error rather than
  // failing with an opaque proxy crash.
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  /*
   * API routes authenticate themselves and answer with JSON. Redirecting them
   * to /login would hand a `fetch()` caller an HTML page with a 307, which
   * fails at `response.json()` and surfaces as a confusing network error
   * instead of "Not authenticated". The session refresh above has already run,
   * so the route handler sees the same session the proxy did.
   */
  if (pathname.startsWith("/api/")) {
    return response;
  }

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Keeping images and
     * fonts out of the matcher avoids a pointless auth round-trip per asset.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
