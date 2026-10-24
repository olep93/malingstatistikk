/* eslint-disable @next/next/no-html-link-for-pages -- "/" is the portal, another app (zone) on the same domain. */
import { LockKeyhole } from "lucide-react";
import { NO_ACCESS } from "@/lib/app-access";
import { basePath } from "@/lib/base-path";
import { PortalLogo } from "@/components/PortalLogo";

// The app name is a full page load: with basePath, Vercel does not find the root's RSC for client navigation.
// Signed in through the portal, but the portal has not given this account Malingstatistikk.
export default function NoAccess() {
  return <>
    <header className="appTopbar"><PortalLogo/><span className="portalDivider" aria-hidden="true"/><a className="appName" href={basePath}>Malingstatistikk</a></header>
    <div className="auth"><div className="authCard"><LockKeyhole/><span className="eyebrow">JOBBVERKTØY</span><h1>{NO_ACCESS}</h1><p>Kontoen din er ikke gitt tilgang til Malingstatistikk. Kontakt administrator hvis du skal ha det.</p><a className="primary" href="/">Til Jobbverktøy</a></div></div>
  </>;
}
