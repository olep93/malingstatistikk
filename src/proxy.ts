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
  // Portalens server-til-server-kall har ingen innlogging, men er signert (se api/portal/users).
  if (path.startsWith("/api/portal/")) return NextResponse.next();
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
  // Behind the portal's rewrite the portal is the same origin (x-forwarded-host), so its pages are reached
  // there and the sign-in cookie lands on the right host. request.url is this app's own Vercel host there,
  // so never build Locations from it. A request straight to this app's own host has no portal session (the cookie
  // lives on the portal's host), so it is sent to the portal's absolute address instead. Never redirect a
  // signed-in user to the portal's /malingstatistikk: if this check misjudged, that would loop.
  const forwardedHost = request.headers.get("x-forwarded-host");
  // Only the portal's own hosts, so a forged header cannot redirect sign-in elsewhere.
  const viaPortal = Boolean(forwardedHost && forwardedHost !== request.headers.get("host") &&
    /^(?:jobbverktoy\.no|jobbverktoy-[a-z0-9-]+\.vercel\.app)$/.test(forwardedHost));
  const here = basePath + (path === "/" ? "" : path) + request.nextUrl.search;
  // Next's proxy rejects a relative Location, so behind the portal the address is built from its host.
  const origin = viaPortal ? `https://${forwardedHost}` : portalUrl;
  const portal = (page: string) => origin + page;

  if (!user) return isApi ? deny(401, "Ikke innlogget.") : redirect(portal(`/logg-inn?neste=${encodeURIComponent(here)}`));
  if (mustChangePassword(user)) return isApi ? deny(403, "Du må bytte passord i Jobbverktøy.") : redirect(portal("/nytt-passord"));
  if (!hasMalingstatistikkAccess(user)) {
    if (isApi) return deny(403, NO_ACCESS);
    if (path !== "/ingen-tilgang") return redirect(portal(`${basePath}/ingen-tilgang`));
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // "/" covers the bare basePath (/malingstatistikk), which the pattern below does not match.
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
