import "server-only";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type RolJwt,
} from "@/lib/auth/session";

export type CurrentUser = {
  id: number;
  nombre: string;
  email: string;
  rol: RolJwt;
  activo: boolean;
  tokenVersion: number;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const claims = await verifySessionToken(token);

  if (!claims) return null;

  const userId = Number(claims.sub);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  const rows = await query<CurrentUser>(
    `SELECT id, nombre, email, rol, activo, token_version AS "tokenVersion"
       FROM usuarios
      WHERE id = $1
        AND token_version = $2
        AND activo = true
        AND eliminado_en IS NULL`,
    [userId, claims.tv],
  );

  return rows[0] ?? null;
}
