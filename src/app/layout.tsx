import type { Metadata, Viewport } from "next";
import "./globals.css";

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

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="nb"><body>{children}</body></html>}
