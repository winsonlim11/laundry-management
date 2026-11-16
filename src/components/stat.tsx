import { clsx as cx } from "clsx";

export function Stat({ label, value, period, tone, href }: { label: string; value: React.ReactNode; period: string; tone?: "blue" | "amber" | "green" | "violet"; href?: string }) {
  const inner = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <p className="min-w-0 text-xs font-medium text-slate-500">{label}</p>
        <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-medium", {
          blue: "bg-brand-50 text-brand-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700",
        }[tone ?? "blue"])}>{period}</span>
      </div>
      <p className="tabular mt-2 break-words text-lg font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
    </>
  );
  const cls = "block min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
  return href ? <a href={href} className={cx(cls, "hover:border-brand-200")}>{inner}</a> : <div className={cls}>{inner}</div>;
}
