import { portalHome } from "@/lib/base-path";

/**
 * Jobbverktøy-logoen helt til venstre i toppfeltet, likt i alle verktøyene. Portalen er en annen app
 * (zone) på samme opphav, så både lenken og bildet er portalens egne stier, og lenken er en vanlig <a>.
 */
export function PortalLogo() {
  return <a className="portalLogo" href={portalHome} aria-label="Jobbverktøy – alle verktøy" title="Jobbverktøy">
    {/* eslint-disable-next-line @next/next/no-img-element -- portalens fil, ikke en del av denne appen */}
    <img src="/logo.svg" width={28} height={28} alt="" />
  </a>;
}
