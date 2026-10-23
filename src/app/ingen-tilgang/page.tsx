/* eslint-disable @next/next/no-html-link-for-pages -- "/" is the portal, another app (zone) on the same domain. */
import { LockKeyhole } from "lucide-react";
import { NO_ACCESS } from "@/lib/app-access";

// Signed in through the portal, but the portal has not given this account Malingstatistikk.
export default function NoAccess() {
  return <div className="auth"><div className="authCard"><LockKeyhole/><span className="eyebrow">JOBBVERKTØY</span><h1>{NO_ACCESS}</h1><p>Kontoen din er ikke gitt tilgang til Malingstatistikk. Kontakt administrator hvis du skal ha det.</p><a className="primary" href="/">Til Jobbverktøy</a></div></div>;
}
