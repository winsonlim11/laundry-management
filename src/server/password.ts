import bcrypt from "bcryptjs";
import { AppError } from "./errors";

export async function hashPassword(pw: string) {
  if (pw.length < 8) throw new AppError(400, "Kata sandi minimal 8 karakter.");
  if (pw.length > 128) throw new AppError(400, "Kata sandi terlalu panjang.");
  return bcrypt.hash(pw, 10);
}
