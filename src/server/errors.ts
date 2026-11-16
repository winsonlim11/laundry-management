import { z } from "zod";

// pesan validasi bawaan Zod dalam Bahasa Indonesia
z.config(z.locales.id());

export class AppError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "AppError";
  }
}
export const badRequest = (m: string) => new AppError(400, m, "BAD_REQUEST");
export const unauthorized = (m = "Silakan masuk terlebih dahulu.") => new AppError(401, m, "UNAUTHORIZED");
export const forbidden = (m = "Anda tidak memiliki akses untuk tindakan ini.") => new AppError(403, m, "FORBIDDEN");
export const notFound = (m = "Data tidak ditemukan.") => new AppError(404, m, "NOT_FOUND");
export const conflict = (m: string) => new AppError(409, m, "CONFLICT");
