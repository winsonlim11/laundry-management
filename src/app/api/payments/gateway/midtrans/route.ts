import { NextResponse, type NextRequest } from "next/server";
import { handleMidtransNotification } from "@/server/services/payments";
import { errorResponse } from "@/server/http";
/** Webhook Midtrans — tanpa sesi/CSRF; keaslian dicek lewat signature_key SHA-512. */
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as Record<string, unknown>;
    return NextResponse.json(await handleMidtransNotification(b));
  } catch (e) {
    return errorResponse(e);
  }
}
