import { redirect } from "next/navigation";
import { getActor } from "@/server/auth";
import { needsSetup } from "@/server/services/setup";
import { getSettings } from "@/server/services/settings";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk" };

export default async function LoginPage() {
  if (await needsSetup()) redirect("/setup");
  if (await getActor()) redirect("/");
  const s = await getSettings();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">{s.name.slice(0, 1).toUpperCase()}</div>
          <h1 className="text-xl font-semibold">{s.name}</h1>
          <p className="text-sm text-slate-500">Masuk untuk melanjutkan</p>
        </div>
        <LoginForm demo={process.env.DEMO_SEED === "true"} />
        <p className="mt-8 text-center text-xs text-slate-400">Developed by CHIRP DEV</p>
      </div>
    </main>
  );
}
