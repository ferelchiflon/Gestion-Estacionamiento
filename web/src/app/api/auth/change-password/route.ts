import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auditar } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guards";
import { withTransaction } from "@/lib/db";
import { ApiError, assertSameOrigin, clientIp, errorResponse } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMON_PASSWORDS = new Set([
  "123456", "password", "123456789", "12345678", "12345", "1234567", "1234567890",
  "qwerty", "abc123", "password1", "admin", "letmein", "welcome", "monkey",
  "dragon", "master", "hello", "freedom", "whatever", "qazwsx", "trustno1",
  "654321", "jordan23", "harley", "password123", "123123", "superman", "iloveyou",
  "sunshine", "princess", "admin123", "football", "monkey123", "abc123456",
  "qwerty123", "111111", "123321", "passw0rd", "shadow", "michael", "charlie",
  "baseball", "ashley", "bailey", "pass", "1234", "andrea", "daniel", "computer",
  "michelle", "jennifer", "jessica", "joshua", "william", "amanda", "matthew",
  "david", "joseph", "andrew", "christopher", "thomas", "james", "robert",
  "richard", "donald", "steven", "kevin", "ryan", "jason", "brian", "jeffrey",
  "gary", "timothy", "eric", "stephen", "mark", "paul", "laura", "amanda",
  "karen", "lisa", "sandra", "ashley", "kimberly", "donna", "michelle", "carol",
  "emily", "nancy", "betty", "margaret", "susan", "jessica", "dorothy", "sarah",
  "karen", "nancy", "betty", "margaret", "susan", "jessica", "dorothy", "sarah",
]);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z
    .string()
    .min(12, "La nueva contraseña debe tener al menos 12 caracteres")
    .max(72)
    .regex(/[A-Za-z]/, "La nueva contraseña debe tener letras")
    .regex(/[0-9]/, "La nueva contraseña debe tener números")
    .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase()), {
      message: "La contraseña es demasiado común, elija otra",
    }),
});

type UsuarioRow = {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "operador" | "contador";
  password_hash: string;
  activo: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: Date | null;
  token_version: number;
  debe_cambiar_password: boolean;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const sesion = await requireApiUser(["admin", "operador", "contador"]);
    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", code: "VALIDATION_ERROR", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const ip = clientIp(request);

    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query<UsuarioRow>(
        `SELECT id, nombre, email, rol, password_hash, activo,
                intentos_fallidos, bloqueado_hasta, token_version, debe_cambiar_password
           FROM usuarios
          WHERE id = $1
            AND eliminado_en IS NULL
          FOR UPDATE`,
        [sesion.id],
      );

      const usuario = rows[0];

      if (!usuario || !usuario.activo) {
        throw new ApiError(401, "UNAUTHENTICATED", "Usuario no encontrado");
      }

      const claveValida = await bcrypt.compare(currentPassword, usuario.password_hash);

      if (!claveValida) {
        const intentos = usuario.intentos_fallidos + 1;
        const bloquear = intentos >= 5;

        await client.query(
          `UPDATE usuarios
              SET intentos_fallidos = $2,
                  bloqueado_hasta = CASE WHEN $3 THEN now() + interval '15 minutes' ELSE bloqueado_hasta END,
                  actualizado_en = now()
            WHERE id = $1`,
          [usuario.id, intentos, bloquear],
        );

        await auditar(client, {
          usuarioId: usuario.id,
          accion: "UPDATE",
          tabla: "usuarios",
          registroId: usuario.id,
          antes: { intentos_fallidos: usuario.intentos_fallidos },
          despues: { intentos_fallidos: intentos, bloqueado: bloquear },
          ip,
        });

        throw new ApiError(401, "INVALID_CURRENT_PASSWORD", "Contraseña actual incorrecta");
      }

      const newHash = await bcrypt.hash(newPassword, 12);

      await client.query(
        `UPDATE usuarios
            SET password_hash = $2,
                intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                debe_cambiar_password = false,
                token_version = token_version + 1,
                actualizado_en = now()
          WHERE id = $1`,
        [usuario.id, newHash],
      );

      await auditar(client, {
        usuarioId: usuario.id,
        accion: "UPDATE",
        tabla: "usuarios",
        registroId: usuario.id,
        antes: { intentos_fallidos: usuario.intentos_fallidos, debe_cambiar_password: usuario.debe_cambiar_password },
        despues: { password_cambiada: true, intentos_fallidos: 0, debe_cambiar_password: false },
        ip,
      });

      return { usuario };
    });

    const { signSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } = await import("@/lib/auth/session");

    const updated = await withTransaction(async (client) => {
      const { rows } = await client.query<{ token_version: number }>(
        `SELECT token_version FROM usuarios WHERE id = $1`,
        [sesion.id],
      );
      return rows;
    });

    const token = await signSession({
      id: sesion.id,
      email: sesion.email,
      nombre: sesion.nombre,
      rol: sesion.rol,
      tokenVersion: updated[0]?.token_version ?? sesion.tokenVersion,
    });

    const response = NextResponse.json({ ok: true, message: "Contraseña cambiada correctamente" });

    response.cookies.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}