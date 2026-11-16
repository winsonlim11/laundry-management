import { notFound, redirect } from "next/navigation";
import { pageActor } from "@/server/page";
import { findOrderByRef } from "@/server/services/orders";
import { AppError } from "@/server/errors";

export const dynamic = "force-dynamic";

/** Tujuan QR di struk. Tetap membutuhkan login & hak akses ke nota. */
export default async function RefRedirect({ params }: { params: Promise<{ ref: string }> }) {
  const actor = await pageActor();
  const { ref } = await params;
  let id: number;
  try { id = await findOrderByRef(actor, ref); } catch (e) { if (e instanceof AppError) notFound(); throw e; }
  redirect(`/pesanan/${id}`);
}
