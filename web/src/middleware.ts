import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionClaims,
} from "@/lib/auth/session";

const PUBLIC_GET_PATHS = new Set(["/login"]);
const PUBLIC_POST_PATHS = new Set(["/api/auth/login"]);

function isApi(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function denyApi(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function denyPage(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    request.nextUrl.protocol.replace(":", "");

  if (!host) return false;
  const originUrl = new URL(origin);
  return originUrl.host === host && originUrl.protocol === `${proto}:`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  // Las mutaciones verifican Origin además de depender de SameSite=Lax.
  if (isMutation && !sameOrigin(request)) {
    return isApi(pathname)
      ? denyApi(403, "ORIGIN_INVALIDO", "Origin no coincide")
      : new NextResponse("Origin no coincide", { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims: SessionClaims | null = await verifySessionToken(token);

  if (PUBLIC_GET_PATHS.has(pathname) && method === "GET") {
    if (claims) return denyPage(request, "/dashboard");
    return NextResponse.next();
  }

  const isPublicMutation =
    PUBLIC_POST_PATHS.has(pathname) && method === "POST";
  if (isPublicMutation) return NextResponse.next();

  if (!claims) {
    return isApi(pathname)
      ? denyApi(401, "UNAUTHENTICATED", "Sesión requerida")
      : denyPage(request, "/login");
  }

  const adminOnly =
    pathname === "/usuarios" ||
    pathname.startsWith("/usuarios/") ||
    pathname === "/api/usuarios" ||
    pathname.startsWith("/api/usuarios/");

  if (adminOnly && claims.rol !== "admin") {
    return isApi(pathname)
      ? denyApi(403, "FORBIDDEN", "No tenés permiso para esta acción")
      : denyPage(request, "/dashboard");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
