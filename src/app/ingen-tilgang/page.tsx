import { LockKeyhole } from "lucide-react";
import { portalUrl } from "@/lib/base-path";
import { NO_ACCESS } from "@/lib/app-access";

// Signed in through the portal, but the portal has not given this account Malingstatistikk.
export default function NoAccess() {
  return <div className="auth"><div className="authCard"><LockKeyhole/><span className="eyebrow">JOBBVERKTØY</span><h1>{NO_ACCESS}</h1><p>Kontoen din er ikke gitt tilgang til Malingstatistikk. Kontakt administrator hvis du skal ha det.</p><a className="primary" href={portalUrl}>Til Jobbverktøy</a></div></div>;
}
