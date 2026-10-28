import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auditar } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guards";
import { query, withTransaction } from "@/lib/db";
import {
  ApiError,
  assertSameOrigin,
  clientIp,
  errorResponse,
} from "@/lib/http";
import { userCreateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UsuarioListRow = {
  id: number;
  nombre: string;
  email: string;
  rol: "admin" | "operador" | "contador";
  activo: boolean;
  ultimo_login: Date | null;
  bloqueado_hasta: Date | null;
  creado_en: Date;
  actualizado_en: Date;
};

function isUniqueEmailError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function GET() {
  try {
    await requireApiUser(["admin"], "usuarios.manage");

    const usuarios = await query<UsuarioListRow>(
      `SELECT id, nombre, email, rol, activo, ultimo_login,
              bloqueado_hasta, creado_en, actualizado_en
         FROM usuarios
        WHERE eliminado_en IS NULL
        ORDER BY nombre, id`,
    );

    return NextResponse.json({ usuarios });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actual = await requireApiUser(["admin"], "usuarios.manage");
    assertSameOrigin(request);

    const body = await request.json();
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Datos inválidos", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { nombre, email, password, rol } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);
    const ip = clientIp(request);

    const usuario = await withTransaction(async (client) => {
      const { rows } = await client.query<UsuarioListRow>(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nombre, email, rol, activo, ultimo_login,
                   bloqueado_hasta, creado_en, actualizado_en`,
        [nombre, email, passwordHash, rol],
      );

      await auditar(client, {
        usuarioId: actual.id,
        accion: "INSERT",
        tabla: "usuarios",
        registroId: rows[0].id,
        despues: { nombre, email, rol },
        ip,
      });

      return rows[0];
    });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return NextResponse.json(
        { error: "El email ya está registrado", code: "EMAIL_DUPLICADO" },
        { status: 409 },
      );
    }
    return errorResponse(error);
  }
}
