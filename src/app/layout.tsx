import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./design-system.css";
import "./sales-dashboard.css";
import "./print-report.css";

// Hele jobbverktoy.no er én installerbar app: bruk portalens manifest og ikoner, ikke egne. Da åpner
// logoen og lenker til portalen seg i samme vindu, også i en installert app.
export const metadata: Metadata = {
  title: "Malingstatistikk",
  description: "Daglig malingdashboard",
  manifest: "https://jobbverktoy.no/manifest.webmanifest",
  icons: { apple: "https://jobbverktoy.no/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Jobbverktøy", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#12253e" };

// Gamle adresser (malingstatistikk.vercel.app osv.) sender nettleseren videre til samme side på jobbverktoy.no.
// Portalen henter sidene fra malingstatistikk.vercel.app, men der står jobbverktoy.no i nettleseren, så det går ikke i ring.
// API-kall røres ikke, bare sider som åpnes i nettleseren.
const OLD_HOSTS = ["malingstatistikk.vercel.app", "malingstatistikk-ole93.vercel.app", "malingstatistikk-git-main-ole93.vercel.app"];
const toPortal = `(function(){var l=location;if(${JSON.stringify(OLD_HOSTS)}.indexOf(l.hostname)<0)return;var p=l.pathname.indexOf("/malingstatistikk")===0?l.pathname:"/malingstatistikk"+(l.pathname==="/"?"":l.pathname);l.replace("https://jobbverktoy.no"+p+l.search+l.hash)})()`;

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nb"><body><script dangerouslySetInnerHTML={{__html:toPortal}}/>{children}</body></html>}
