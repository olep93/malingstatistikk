import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasMalingstatistikkAccess, mustChangePassword, NO_ACCESS } from "@/lib/app-access";
import { basePath, portalUrl } from "@/lib/base-path";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Every request needs a portal session (Supabase Auth, cookie shared on jobbverktoy.no) whose account the
 * portal has given Malingstatistikk. getUser() asks Supabase, so a refreshed token is written back here.
 */
export async function proxy(request: NextRequest) {
  const raw = request.nextUrl.pathname;
  const path = raw.startsWith(basePath + "/") ? raw.slice(basePath.length) : raw === basePath ? "/" : raw;
  const isApi = path.startsWith("/api/");
  const deny = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });

  const env = supabaseEnv();
  if (!env) return isApi ? deny(503, "Innlogging er ikke konfigurert.") : new NextResponse("Innlogging er ikke konfigurert.", { status: 503 });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  // Redirects keep the refreshed session cookies.
  const redirect = (location: string) => {
    const r = new NextResponse(null, { status: 307, headers: { Location: location } });
    response.cookies.getAll().forEach(c => r.cookies.set(c));
    return r;
  };

  if (!user) return isApi ? deny(401, "Ikke innlogget.") : redirect(`${portalUrl}/logg-inn`);
  if (mustChangePassword(user)) return isApi ? deny(403, "Du må bytte passord i Jobbverktøy.") : redirect(`${portalUrl}/nytt-passord`);
  if (!hasMalingstatistikkAccess(user)) {
    if (isApi) return deny(403, NO_ACCESS);
    // Relative, so the browser stays on the portal's address.
    if (path !== "/ingen-tilgang") return redirect(`${basePath}/ingen-tilgang`);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
