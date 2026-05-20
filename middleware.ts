import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";

const protectedPrefixes = ["/dashboard", "/crm", "/jobs", "/customers", "/comms", "/money", "/surveys", "/calendar", "/knowledge", "/settings"];
const publicApiPrefixes = ["/api/auth/logout", "/api/weather", "/api/comms/webhooks"];

function isPublicApi(pathname: string) {
  if (pathname.startsWith("/api/quotes/")) {
    return /\/api\/quotes\/[^/]+\/(accept|message)$/.test(pathname);
  }
  return publicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isApi = pathname.startsWith("/api/");
  const isProtectedApi = isApi && !isPublicApi(pathname);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  let session = null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          }
        }
      }
    );

    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch (error) {
    console.error("Middleware session check failed", {
      pathname,
      error: error instanceof Error ? error.message : String(error)
    });

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (pathname === "/login") {
      return response;
    }

    if (isProtectedApi) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }

    if (isProtected) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("auth_error", "1");
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedApi && !session) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/api/:path*",
    "/dashboard/:path*",
    "/crm/:path*",
    "/jobs/:path*",
    "/customers/:path*",
    "/comms/:path*",
    "/money/:path*",
    "/surveys/:path*",
    "/calendar/:path*",
    "/knowledge/:path*",
    "/settings/:path*"
  ]
};
