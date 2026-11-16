import { pageActor } from "@/server/page";
import { PageHeader } from "@/components/ui";
import { Scanner } from "./scanner";

export const metadata = { title: "Pindai nota" };

export default async function ScanPage() {
  await pageActor("orders.view_all");
  return (
    <div className="max-w-xl">
      <PageHeader title="Pindai nota" subtitle="Gunakan kamera untuk QR/barcode, scanner USB (bekerja seperti keyboard), atau ketik kode nota." />
      <Scanner />
    </div>
  );
}
