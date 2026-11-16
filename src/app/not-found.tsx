import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-5xl font-bold text-brand-600">404</p>
      <h1 className="text-lg font-semibold">Halaman atau data tidak ditemukan</h1>
      <p className="text-sm text-slate-500">Data mungkin sudah dihapus atau Anda tidak memiliki akses.</p>
      <Link href="/" className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">Kembali ke dashboard</Link>
    </main>
  );
}
