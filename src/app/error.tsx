"use client";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-lg font-semibold">Terjadi kesalahan</h1>
      <p className="max-w-md text-sm text-slate-500">Halaman gagal dimuat. Coba lagi; jika berulang, hubungi admin dengan kode: {error.digest ?? "-"}</p>
      <button onClick={reset} className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Coba lagi</button>
    </main>
  );
}
