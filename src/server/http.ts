import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError, forbidden } from "./errors";
import { requireActor } from "./auth";
import type { Actor } from "./actor";

type Ctx<P> = { req: NextRequest; params: P; actor: Actor };
type Opts = { auth?: boolean; csrf?: boolean };

export function errorResponse(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    const field = issue?.path?.join(".");
    return NextResponse.json({ error: issue?.message ?? "Input tidak valid.", field, issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Terjadi kesalahan pada server. Silakan coba lagi." }, { status: 500 });
}

/**
 * Proteksi CSRF untuk cookie sesi SameSite=Lax:
 * permintaan yang mengubah data wajib same-origin (Origin/Sec-Fetch-Site) dan membawa header kustom
 * yang tidak bisa dikirim form lintas situs tanpa preflight CORS.
 */
export function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const site = req.headers.get("sec-fetch-site");
  if (origin) {
    try {
      if (new URL(origin).host !== host) throw forbidden("Permintaan lintas situs ditolak.");
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw forbidden("Origin tidak valid.");
    }
  } else if (site && site !== "same-origin" && site !== "none") {
    throw forbidden("Permintaan lintas situs ditolak.");
  }
  if (req.headers.get("x-requested-with") !== "laundry-app") throw forbidden("Header keamanan tidak ada.");
}

export function api<P = Record<string, string>>(handler: (ctx: Ctx<P>) => Promise<unknown>, opts: Opts = {}) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    try {
      if (opts.csrf !== false) assertSameOrigin(req);
      const actor = opts.auth === false ? (null as unknown as Actor) : await requireActor();
      const params = ctx?.params ? await ctx.params : ({} as P);
      const out = await handler({ req, params, actor });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function body(req: NextRequest): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 1_000_000) throw new AppError(413, "Data terlalu besar.");
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "Format JSON tidak valid.");
  }
}

export const id = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, "ID tidak valid.");
  return n;
};

export const query = (req: NextRequest) => Object.fromEntries(req.nextUrl.searchParams.entries());
