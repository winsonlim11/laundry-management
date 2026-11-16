"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Bike, Circle, History, LayoutDashboard, LogOut, Menu, ReceiptText, ScanLine, Settings, ShoppingBasket, Truck, UserCog, Users, Wallet, WashingMachine, X } from "lucide-react";

const ICONS = { BarChart3, Bike, History, LayoutDashboard, ReceiptText, ScanLine, Settings, ShoppingBasket, Truck, UserCog, Users, Wallet, WashingMachine } as Record<string, React.ComponentType<{ className?: string }>>;
import { cx } from "./ui";
import type { NavItem } from "./nav";
import { apiFetch } from "@/lib/client";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Circle;
  return <C className={className} aria-hidden />;
}

export function Shell({ items, user, business, children }: { items: NavItem[]; user: { name: string; role: string }; business: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  const logout = async () => { await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {}); window.location.href = "/login"; };
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Navigasi utama">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
          className={cx("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition", active(i.href) ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")}>
          <Icon name={i.icon} className="size-4" />{i.label}
        </Link>
      ))}
    </nav>
  );
  const userBox = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{user.name.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.role}</p>
        </div>
        <button onClick={logout} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Keluar" title="Keluar"><LogOut className="size-4" /></button>
      </div>
      <p className="mt-3 text-[10px] text-slate-400">Developed by CHIRP DEV</p>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <div className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{business.slice(0, 1).toUpperCase()}</div>
          <span className="truncate font-semibold">{business}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{nav}</div>
        {userBox}
      </aside>
      {/* topbar mobile */}
      <header className="no-print sticky top-0 z-30 flex h-12 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{business.slice(0, 1).toUpperCase()}</div>
          <span className="font-semibold">{business}</span>
        </div>
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-slate-600" aria-label="Buka menu" aria-expanded={open}><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-12 items-center justify-between border-b px-3">
              <span className="font-semibold">Menu</span>
              <button onClick={() => setOpen(false)} className="rounded-md p-2" aria-label="Tutup menu"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{nav}</div>
            {userBox}
          </div>
        </div>
      )}
      <main className="pb-24 md:pb-10 md:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-7">{children}</div>
      </main>
      {/* bottom nav mobile */}
      {mobileItems.length > 1 && (
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" style={{ gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))` }} aria-label="Navigasi bawah">
          {mobileItems.map((i) => (
            <Link key={i.href} href={i.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", active(i.href) ? "text-brand-700" : "text-slate-500")}>
              <Icon name={i.icon} className="size-5" />{i.label}
            </Link>
          ))}
          <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500"><Menu className="size-5" />Lainnya</button>
        </nav>
      )}
    </div>
  );
}
