"use client";
import { useEffect, useState } from "react";
import { House } from "lucide-react";

/**
 * Back to the portal's tool picker. Shown only when the app is opened through the portal
 * (jobbverktoy.no/malingstatistikk); the app's own Vercel host has no portal to go back to.
 * A plain link, since the portal is another app on the same domain.
 */
export function PortalHome() {
  const [show, setShow] = useState(false);
  // The host is only known in the browser.
  useEffect(() => { queueMicrotask(() => setShow(!/^malingstatistikk[^.]*\.vercel\.app$/.test(location.hostname))); }, []);
  if (!show) return null;
  // The portal is another app (zone) on the same domain, so a plain link.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a href="/" className="portalHome" aria-label="Hjem til Jobbverktøy" title="Hjem til Jobbverktøy">
    <House size={16} aria-hidden="true" /><span>Hjem</span>
  </a>;
}
