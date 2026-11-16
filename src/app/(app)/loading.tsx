import { Loader2 } from "lucide-react";
export default function Loading() {
  return <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500" role="status"><Loader2 className="size-4 animate-spin" />Memuat…</div>;
}
