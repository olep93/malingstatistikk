import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Malingstatistikk", description: "Daglig salgsdashboard for eksteriørmaling" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nb"><body>{children}</body></html>;
}
