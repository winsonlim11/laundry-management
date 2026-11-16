import { redirect } from "next/navigation";
import { needsSetup } from "@/server/services/setup";
import { SetupForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup awal" };

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold">Setup awal</h1>
        <p className="mb-5 text-sm text-slate-500">Buat akun Owner pertama. Halaman ini otomatis tertutup setelah akun pertama dibuat.</p>
        <SetupForm />
        <p className="mt-8 text-center text-xs text-slate-400">Developed by CHIRP DEV</p>
      </div>
    </main>
  );
}
