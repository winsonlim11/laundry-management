import { api, id } from "@/server/http";
import { uploadTaskPhoto, MAX_PHOTO_BYTES } from "@/server/services/logistics";
import { AppError, badRequest } from "@/server/errors";
type P = { type: string; id: string };
export const POST = api<P>(async ({ req, params, actor }) => {
  if (params.type !== "pickup" && params.type !== "delivery") throw badRequest("Jenis tugas tidak valid.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES + 100_000) throw new AppError(413, "Ukuran foto maksimal 3 MB.");
  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) throw badRequest("Pilih foto terlebih dahulu.");
  if (file.size > MAX_PHOTO_BYTES) throw badRequest("Ukuran foto maksimal 3 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  return uploadTaskPhoto(actor, params.type, id(params.id), buf, file.type);
});
