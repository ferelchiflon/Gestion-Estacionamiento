import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auditar } from "@/lib/audit";
import { withTransaction } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth/session";
import { assertSameOrigin, clientIp, errorResponse } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Credenciales inválidas", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    const { email, password } = parsed.data;
    const ip = clientIp(request);

    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query<UsuarioRow>(
        `SELECT id, nombre, email, rol, password_hash, activo,
                intentos_fallidos, bloqueado_hasta, token_version
           FROM usuarios
          WHERE lower(email) = lower($1)
            AND eliminado_en IS NULL
          FOR UPDATE`,
        [email],
      );
      const usuario = rows[0];

      if (!usuario || !usuario.activo) {
        return { kind: "invalido" as const };
      }

      if (
        usuario.bloqueado_hasta &&
        new Date(usuario.bloqueado_hasta).getTime() > Date.now()
      ) {
        return { kind: "bloqueado" as const };
      }

      const claveValida = await bcrypt.compare(
        password,
        usuario.password_hash,
      );

      if (!claveValida) {
        const intentos = usuario.intentos_fallidos + 1;
        const bloquear = intentos >= 5;

        const { rows: actualizados } = await client.query<{ ultimo_login: Date }>(
          `UPDATE usuarios
              SET intentos_fallidos = $2,
                  bloqueado_hasta = CASE WHEN $3 THEN now() + interval '15 minutes' ELSE bloqueado_hasta END,
                  actualizado_en = now()
            WHERE id = $1
            RETURNING ultimo_login`,
          [usuario.id, intentos, bloquear],
        );

        await auditar(client, {
          usuarioId: usuario.id,
          accion: "UPDATE",
          tabla: "usuarios",
          registroId: usuario.id,
          antes: { intentos_fallidos: usuario.intentos_fallidos },
          despues: {
            intentos_fallidos: intentos,
            bloqueado: bloquear,
          },
          ip,
        });

        return {
          kind: "invalido" as const,
          ultimoLogin: actualizados[0]?.ultimo_login ?? null,
        };
      }

      const { rows: actualizados } = await client.query<{
        ultimo_login: Date;
      }>(
        `UPDATE usuarios
            SET intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                ultimo_login = now(),
                actualizado_en = now()
          WHERE id = $1
          RETURNING ultimo_login`,
        [usuario.id],
      );

      await auditar(client, {
        usuarioId: usuario.id,
        accion: "UPDATE",
        tabla: "usuarios",
        registroId: usuario.id,
        antes: { intentos_fallidos: usuario.intentos_fallidos },
        despues: { login_exitoso: true },
        ip,
      });

      return {
        kind: "ok" as const,
        usuario,
        ultimoLogin: actualizados[0]?.ultimo_login ?? null,
      };
    });

    if (resultado.kind === "bloqueado") {
      return NextResponse.json(
        {
          error: "Cuenta bloqueada temporalmente",
          code: "ACCOUNT_LOCKED",
        },
        { status: 423 },
      );
    }

    if (resultado.kind !== "ok") {
      return NextResponse.json(
        { error: "Credenciales inválidas", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    const usuario = resultado.usuario;
    const token = await signSession({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      tokenVersion: usuario.token_version,
    });

    const response = NextResponse.json({
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
