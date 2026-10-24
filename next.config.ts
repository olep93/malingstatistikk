import type { NextConfig } from "next";

// Malingstatistikk is served under the portal: jobbverktoy.no/malingstatistikk is rewritten to this app,
// which therefore lives entirely under /malingstatistikk (see src/lib/base-path.ts). The old address
// keeps working: its old paths are sent on to /malingstatistikk on the same host below.
const BASE = "/malingstatistikk";

const nextConfig: NextConfig = {
  basePath: BASE,
  async redirects() {
    return [
      // Old bookmarks and API callers. 307 keeps the method and body.
      { source: "/", destination: BASE, basePath: false, permanent: false },
      // A path is already under the base path when it is the base path itself or continues with "/" or "."
      // (/malingstatistikk.rsc, /malingstatistikk.segments/… are how the router fetches the app's root).
      { source: "/:path((?!malingstatistikk(?:[/.]|$)|_next/).*)", destination: `${BASE}/:path`, basePath: false, permanent: false },
    ];
  },
};

export default nextConfig;
