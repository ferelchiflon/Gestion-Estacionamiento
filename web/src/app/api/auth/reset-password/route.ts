import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auditar } from "@/lib/audit";
import { withTransaction } from "@/lib/db";
import { assertSameOrigin, clientIp, errorResponse } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(150),
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(12, "La nueva contraseña debe tener al menos 12 caracteres")
    .max(72)
    .regex(/[A-Za-z]/, "La nueva contraseña debe tener letras")
    .regex(/[0-9]/, "La nueva contraseña debe tener números"),
});

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
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", code: "VALIDATION_ERROR", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, token, newPassword } = parsed.data;
    const ip = clientIp(request);

    // Validar contraseña no común
    if (COMMON_PASSWORDS.has(newPassword.toLowerCase())) {
      return NextResponse.json(
        { error: "La contraseña es demasiado común, elija otra", code: "WEAK_PASSWORD" },
        { status: 400 },
      );
    }

    await withTransaction(async (client) => {
      // Buscar usuario
      const { rows: users } = await client.query<{ id: number }>(
        `SELECT id FROM usuarios WHERE lower(email) = lower($1) AND eliminado_en IS NULL`,
        [email],
      );
      if (users.length === 0) {
        throw new Error("USER_NOT_FOUND");
      }
      const usuarioId = users[0].id;

      // Buscar token válido
      const { rows: tokens } = await client.query<{ token_hash: string; expira_en: Date; usado_en: Date | null }>(
        `SELECT token_hash, expira_en, usado_en FROM password_reset_tokens
           WHERE usuario_id = $1 AND usado_en IS NULL
           ORDER BY creado_en DESC LIMIT 1`,
        [usuarioId],
      );
      if (tokens.length === 0) {
        throw new Error("TOKEN_NOT_FOUND");
      }
      const tokenRecord = tokens[0];

      // Verificar expiración
      if (new Date(tokenRecord.expira_en).getTime() <= Date.now()) {
        throw new Error("TOKEN_EXPIRED");
      }

      // Verificar token
      const tokenValid = await bcrypt.compare(token, tokenRecord.token_hash);
      if (!tokenValid) {
        throw new Error("TOKEN_INVALID");
      }

      // Marcar token como usado
      await client.query(
        `UPDATE password_reset_tokens SET usado_en = now() WHERE usuario_id = $1 AND token_hash = $2`,
        [usuarioId, tokenRecord.token_hash],
      );

      // Invalidar otros tokens del usuario
      await client.query(
        `UPDATE password_reset_tokens SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL`,
        [usuarioId],
      );

      // Actualizar contraseña
      const newHash = await bcrypt.hash(newPassword, 12);
      await client.query(
        `UPDATE usuarios
            SET password_hash = $2,
                debe_cambiar_password = false,
                token_version = token_version + 1,
                actualizado_en = now()
          WHERE id = $1`,
        [usuarioId, newHash],
      );

      // Auditoría
      await auditar(client, {
        usuarioId,
        accion: "UPDATE",
        tabla: "usuarios",
        registroId: usuarioId,
        antes: { password_reset_via_token: true },
        despues: { password_cambiada: true, debe_cambiar_password: false },
        ip,
      });

      return { usuarioId };
    });

    return NextResponse.json({ ok: true, message: "Contraseña restablecida correctamente" });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND" || error.message === "TOKEN_NOT_FOUND" || error.message === "TOKEN_INVALID") {
        return NextResponse.json(
          { error: "Token inválido o expirado", code: "INVALID_TOKEN" },
          { status: 400 },
        );
      }
      if (error.message === "TOKEN_EXPIRED") {
        return NextResponse.json(
          { error: "El token ha expirado. Solicita un nuevo reset.", code: "TOKEN_EXPIRED" },
          { status: 400 },
        );
      }
    }
    return errorResponse(error);
  }
}