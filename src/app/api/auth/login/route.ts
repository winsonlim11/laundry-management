import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/server/auth";
import { assertSameOrigin, errorResponse } from "@/server/http";

const input = z.object({ username: z.string().min(1, "Username wajib diisi.").max(60), password: z.string().min(1, "Kata sandi wajib diisi.").max(200) });

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { username, password } = input.parse(await req.json().catch(() => ({})));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
    const user = await login(username, password, ip, req.headers.get("user-agent") ?? undefined);
    return NextResponse.json({ ok: true, name: user.name });
  } catch (e) {
    return errorResponse(e);
  }
}
