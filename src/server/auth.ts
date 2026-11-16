import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { prisma } from "./db";
import type { Actor } from "./actor";
import { loadActorByUserId } from "./actor-loader";
export { loadActorByUserId };
import { AppError, unauthorized } from "./errors";
import { logActivity } from "./services/activity";

type SessionData = { sid?: string };
const SESSION_DAYS = 7;

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter");
  return {
    password,
    cookieName: "laundry_session",
    ttl: SESSION_DAYS * 86400,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function getActor(): Promise<Actor | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  if (!session.sid) return null;
  const row = await prisma.session.findUnique({ where: { id: hashToken(session.sid) } });
  if (!row || row.expiresAt < new Date()) return null;
  return loadActorByUserId(row.userId);
}

export async function requireActor(): Promise<Actor> {
  const a = await getActor();
  if (!a) throw unauthorized();
  return a;
}

const MAX_FAILS_PER_USER = 5;
const MAX_FAILS_PER_IP = 20;
const WINDOW_MIN = 15;

export async function login(username: string, password: string, ip: string, userAgent?: string) {
  const uname = username.trim().toLowerCase();
  const since = new Date(Date.now() - WINDOW_MIN * 60000);
  const [userFails, ipFails] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: `u:${uname}`, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { key: `ip:${ip}`, success: false, createdAt: { gte: since } } }),
  ]);
  if (userFails >= MAX_FAILS_PER_USER || ipFails >= MAX_FAILS_PER_IP)
    throw new AppError(429, `Terlalu banyak percobaan gagal. Coba lagi dalam ${WINDOW_MIN} menit.`);

  const user = await prisma.user.findUnique({ where: { username: uname } });
  // bandingkan tetap dijalankan walau user tidak ada agar waktu respons seragam
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok || !user.active) {
    await prisma.loginAttempt.createMany({
      data: [{ key: `u:${uname}`, success: false }, { key: `ip:${ip}`, success: false }],
    });
    throw new AppError(401, "Username atau kata sandi salah.");
  }
  await prisma.loginAttempt.create({ data: { key: `u:${uname}`, success: true } });
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), userAgent: userAgent?.slice(0, 200) },
  });
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  session.sid = token;
  await session.save();
  await logActivity(prisma, { id: user.id, name: user.name }, "auth.login", "user", String(user.id));
  return user;
}

export async function logout() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions());
  if (session.sid) {
    const row = await prisma.session.findUnique({ where: { id: hashToken(session.sid) }, include: { user: true } });
    await prisma.session.deleteMany({ where: { id: hashToken(session.sid) } });
    if (row) await logActivity(prisma, { id: row.user.id, name: row.user.name }, "auth.logout", "user", String(row.userId));
  }
  session.destroy();
}

export { hashPassword } from "./password";
