"use client";
import { BarChart3, Boxes, CalendarDays, FileText, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";

type Page = "dashboard" | "products" | "history" | "print" | "admin";
const items: { id: Page; label: string; icon: React.ComponentType<{size?: number}> }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "products", label: "Produktsalg", icon: Boxes },
  { id: "history", label: "Historikk", icon: CalendarDays },
  { id: "print", label: "Rapport", icon: FileText },
];
export function AppShell({ page, setPage, children }: { page: Page; setPage: (p: Page)=>void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="shell">
    <header className="topbar">
      <button className="mobileMenu" onClick={()=>setOpen(!open)} aria-label="Meny">{open?<X/>:<Menu/>}</button>
      <button className="brand" onClick={()=>setPage("dashboard")}><span className="brandMark">M</span><span><b>Malingstatistikk</b><small>OBS BYGG TØNSBERG</small></span></button>
      <nav className={open ? "nav open" : "nav"}>
        {items.map(item => <button key={item.id} className={page===item.id?"active":""} onClick={()=>{setPage(item.id);setOpen(false)}}><item.icon size={18}/>{item.label}</button>)}
      </nav>
      <button className="loginButton" onClick={()=>setPage("admin")}><LogIn size={18}/> Logg inn</button>
    </header>
    <main>{children}</main>
    <footer>Internt rapportverktøy · Demo V1</footer>
  </div>
}
