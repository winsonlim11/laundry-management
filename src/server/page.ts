import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getActor } from "./auth";
import type { Actor } from "./actor";
import type { PermissionKey } from "@/lib/permissions";

export async function pageActor(...anyOf: PermissionKey[]): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect("/login");
  if (anyOf.length && !anyOf.some((p) => a.permissions.has(p))) redirect("/?denied=1");
  return a;
}

export async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
