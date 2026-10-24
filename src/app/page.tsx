import { PaintDashboard } from "@/components/PaintDashboard";

// Rendered per request: with basePath, Vercel does not find the prerendered RSC for the root
// (/malingstatistikk.rsc), so client navigation to "/" (the brand link) got 404.
export const dynamic = "force-dynamic";

export default function Home(){return <PaintDashboard/>}
