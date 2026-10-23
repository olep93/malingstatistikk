/**
 * Malingstatistikk is served under the portal at jobbverktoy.no/malingstatistikk (Next.js multi-zones),
 * so every page, API route and public file lives under this prefix. `<Link>`, the router and `redirect()`
 * add it themselves; plain `fetch`, `<a href>`, `<img src>`, `window.location` and CSS urls need it.
 */
export const basePath = "/malingstatistikk";

/** The portal's address. Its pages are not part of this app, so links there are plain `<a>` tags. */
export const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://jobbverktoy.no";

/** An app path such as "/api/reports" as the browser must request it. Absolute URLs pass through. */
export function appPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith(basePath + "/") && path !== basePath ? basePath + path : path;
}

/** fetch for this app's own API routes. */
export function apiFetch(input: string, init?: RequestInit) {
  return fetch(appPath(input), init);
}

/** The portal's home behind its rewrite: another app (zone) on the same origin, so a plain `<a>`. */
export const portalHome = "/";
