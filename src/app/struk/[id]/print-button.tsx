"use client";
import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintButton({ printer }: { printer: string }) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") === "1") setTimeout(() => window.print(), 300);
  }, []);
  return (
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700" title={printer ? `Pilih printer: ${printer}` : undefined}>
      <Printer className="size-4" /> Cetak{printer ? ` (${printer})` : ""}
    </button>
  );
}
