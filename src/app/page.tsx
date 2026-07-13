"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Admin, Dashboard, History, PrintReport, Products } from "@/components/Pages";
type Page = "dashboard" | "products" | "history" | "print" | "admin";
export default function Home(){const [page,setPage]=useState<Page>("dashboard");return <AppShell page={page} setPage={setPage}>{page==="dashboard"&&<Dashboard/>}{page==="products"&&<Products/>}{page==="history"&&<History/>}{page==="print"&&<PrintReport/>}{page==="admin"&&<Admin/>}</AppShell>}
