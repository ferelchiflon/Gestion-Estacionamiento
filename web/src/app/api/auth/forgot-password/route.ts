import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { auditar } from "@/lib/audit";
import { withTransaction } from "@/lib/db";
import { assertSameOrigin, clientIp, errorResponse } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(150),
});

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email inválido", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { email } = parsed.data;
    const ip = clientIp(request);

    // Rate limit: max 3 requests per email/hour, 10 per IP/hour
    await withTransaction(async (client) => {
      // Check rate limit for email
      const { rows: emailLimit } = await client.query(
        `SELECT count(*) FROM rate_limit
           WHERE identificador = $1 AND accion = 'forgot_password'
             AND ventana > now() - interval '1 hour'`,
        [email.toLowerCase()],
      );
      if (Number(emailLimit[0].count) >= 3) {
        throw new Error("RATE_LIMIT_EMAIL");
      }

      // Check rate limit for IP
      const { rows: ipLimit } = await client.query(
        `SELECT count(*) FROM rate_limit
           WHERE identificador = $1 AND accion = 'forgot_password'
             AND ventana > now() - interval '1 hour'`,
        [ip],
      );
      if (Number(ipLimit[0].count) >= 10) {
        throw new Error("RATE_LIMIT_IP");
      }

      // Record rate limit
      await client.query(
        `INSERT INTO rate_limit (identificador, accion, ventana, contador)
         VALUES ($1, 'forgot_password', date_trunc('hour', now()) + interval '1 hour', 1)
         ON CONFLICT (identificador, accion, ventana) DO UPDATE SET contador = rate_limit.contador + 1`,
        [email.toLowerCase()],
      );
      await client.query(
        `INSERT INTO rate_limit (identificador, accion, ventana, contador)
         VALUES ($1, 'forgot_password', date_trunc('hour', now()) + interval '1 hour', 1)
         ON CONFLICT (identificador, accion, ventana) DO UPDATE SET contador = rate_limit.contador + 1`,
        [ip],
      );
    });

    // Buscar usuario (case-insensitive)
    const userResult = await withTransaction(async (client) => {
      const { rows } = await client.query<{ id: number; email: string }>(
        `SELECT id, email FROM usuarios WHERE lower(email) = lower($1) AND eliminado_en IS NULL`,
        [email],
      );
      return rows[0];
    });

    // SIEMPRE responder 200 OK con mensaje genérico (no revelar si existe el email)
    if (userResult) {
      const token = generateToken();
      const tokenHash = await bcrypt.hash(token, 12);

      await withTransaction(async (client) => {
        // Invalidar tokens anteriores del usuario
        await client.query(
          `UPDATE password_reset_tokens SET usado_en = now() WHERE usuario_id = $1 AND usado_en IS NULL`,
          [userResult.id],
        );

        // Crear nuevo token
        await client.query(
          `INSERT INTO password_reset_tokens (usuario_id, token_hash, expira_en)
           VALUES ($1, $2, $3)`,
          [userResult.id, tokenHash, new Date(Date.now() + 30 * 60 * 1000)],
        );

        // Auditoría
        await auditar(client, {
          usuarioId: userResult.id,
          accion: "INSERT",
          tabla: "password_reset_tokens",
          registroId: userResult.id,
          despues: { email: userResult.email, accion: "forgot_password_request" },
          ip,
        });
      });

      // Enviar email con token
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/resetear-clave?token=${token}&email=${encodeURIComponent(userResult.email)}`;
      
      const { enviarEmailResetPassword } = await import("@/lib/services/email");
      await enviarEmailResetPassword(userResult.email, token, resetUrl);
    }

    // Respuesta genérica SIEMPRE
    return NextResponse.json({
      message: "Si el email existe en nuestro sistema, recibirás instrucciones para resetear tu contraseña.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "RATE_LIMIT_EMAIL") {
        return NextResponse.json(
          { error: "Demasiadas solicitudes para este email. Intenta más tarde.", code: "RATE_LIMIT" },
          { status: 429 },
        );
      }
      if (error.message === "RATE_LIMIT_IP") {
        return NextResponse.json(
          { error: "Demasiadas solicitudes desde tu IP. Intenta más tarde.", code: "RATE_LIMIT" },
          { status: 429 },
        );
      }
    }
    return errorResponse(error);
  }
}