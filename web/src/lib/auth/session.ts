import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const SESSION_COOKIE = "gestion_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type RolJwt = "admin" | "operador" | "contador";

export type SessionClaims = {
  sub: string;
  email: string;
  nombre: string;
  rol: RolJwt;
  tv: number;
};

export type SessionPayload = {
  id: number;
  email: string;
  nombre: string;
  rol: RolJwt;
  tokenVersion: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 48) {
    throw new Error(
      "AUTH_SECRET no está configurada o tiene menos de 48 caracteres.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    nombre: payload.nombre,
    rol: payload.rol,
    tv: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(payload.id))
    .setIssuedAt()
    .setIssuer("gestion-estacionamiento")
    .setAudience("gestion-estacionamiento-web")
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "gestion-estacionamiento",
      audience: "gestion-estacionamiento-web",
      algorithms: ["HS256"],
    });

    const rol = payload.rol;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.nombre !== "string" ||
      typeof rol !== "string" ||
      !["admin", "operador", "contador"].includes(rol) ||
      typeof payload.tv !== "number"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: rol as RolJwt,
      tv: payload.tv,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
