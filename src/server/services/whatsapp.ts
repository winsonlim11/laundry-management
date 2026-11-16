import { badRequest } from "../errors";
import { normalizePhone } from "./customers";

/** Tautan buka chat (berfungsi tanpa konfigurasi). */
export function waLink(phone: string, message: string) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

/** Kirim lewat API penyedia (opsional). Belum diuji dengan kredensial nyata. */
export async function sendWhatsApp(phone: string, message: string) {
  const provider = process.env.WHATSAPP_PROVIDER;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!provider || !token) throw badRequest("WhatsApp API belum dikonfigurasi. Gunakan tombol \"Buka WhatsApp\".");
  if (provider !== "fonnte") throw badRequest(`Penyedia WhatsApp "${provider}" belum didukung.`);
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token },
    body: new URLSearchParams({ target: normalizePhone(phone), message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) throw badRequest(`Gagal mengirim WhatsApp: ${data.reason ?? res.status}`);
  return { ok: true };
}
