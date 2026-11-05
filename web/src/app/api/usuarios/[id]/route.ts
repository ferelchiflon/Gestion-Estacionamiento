import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auditar } from "@/lib/audit";
import { requireApiUser } from "@/lib/auth/guards";
import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db";
import { ApiError, assertSameOrigin, clientIp, errorResponse } from "@/lib/http";
import { userIdSchema, userUpdateSchema } from "@/lib/validation";
import { randomBytes } from "node:crypto";
import { z } from "zod";

type Rol = "admin" | "operador" | "contador";
type Usuario = {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  token_version: number;
  debe_cambiar_password: boolean;
};

const resetPasswordSchema = z.object({
  action: z.literal("reset_password"),
});

function generateTempPassword(length = 16) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  if (!/[A-Z]/.test(password)) password = password.slice(0, -1) + "A";
  if (!/[a-z]/.test(password)) password = password.slice(0, -1) + "a";
  if (!/[0-9]/.test(password)) password = password.slice(0, -1) + "2";
  if (!/[!@#$%^&*]/.test(password)) password = password.slice(0, -1) + "!";
  return password;
}

function emailDuplicado(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

async function otrosAdmins(client: PoolClient, id: number): Promise<number> {
  const { rows } = await client.query<{ total: string }>(
    `SELECT count(*)::text total FROM usuarios
      WHERE rol='admin' AND activo=true AND eliminado_en IS NULL AND id<>$1`,
    [id],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sesion = await requireApiUser(["admin"], "usuarios.manage");
    assertSameOrigin(request);
    const id = userIdSchema.parse((await context.params).id);
    const body = await request.json();

    // Check for reset_password action
    const resetParsed = resetPasswordSchema.safeParse(body);
    if (resetParsed.success) {
      const ip = clientIp(request);
      const tempPassword = generateTempPassword(16);
      const hash = await bcrypt.hash(tempPassword, 12);

      const usuario = await withTransaction(async (client) => {
        const anterior = (
          await client.query<Usuario>(
            `SELECT id,nombre,email,rol,activo,token_version,debe_cambiar_password FROM usuarios
              WHERE id=$1 AND eliminado_en IS NULL FOR UPDATE`,
            [id],
          )
        ).rows[0];
        if (!anterior) {
          throw new ApiError(404, "USUARIO_NO_ENCONTRADO", "Usuario inexistente");
        }

        if (id === sesion.id) {
          throw new ApiError(
            400,
            "OPERACION_NO_PERMITIDA",
            "No podés resetear tu propia contraseña desde aquí",
          );
        }

        const actualizada = (
          await client.query<Usuario>(
            `UPDATE usuarios
                SET password_hash = $2,
                    debe_cambiar_password = true,
                    intentos_fallidos = 0,
                    bloqueado_hasta = NULL,
                    token_version = token_version + 1,
                    actualizado_en = now()
              WHERE id = $1
              RETURNING id,nombre,email,rol,activo,token_version,debe_cambiar_password`,
            [id, hash],
          )
        ).rows[0];

        await auditar(client, {
          usuarioId: sesion.id,
          accion: "UPDATE",
          tabla: "usuarios",
          registroId: id,
          antes: anterior,
          despues: { ...actualizada, password_reseteada: true, temp_password_generada: true },
          ip,
        });

        return { ...actualizada, tempPassword };
      });

      // Devolver la contraseña temporal SOLO una vez en la respuesta
      return NextResponse.json({
        usuario: usuario,
        tempPassword: usuario.tempPassword,
        message: "Contraseña temporal generada. Muéstrasela al usuario ahora (no se volverá a mostrar).",
      });
    }

    // Normal update flow
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Datos inválidos", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const input = parsed.data;
    const ip = clientIp(request);
    const usuario = await withTransaction(async (client) => {
      const anterior = (
        await client.query<Usuario>(
          `SELECT id,nombre,email,rol,activo,token_version,debe_cambiar_password FROM usuarios
            WHERE id=$1 AND eliminado_en IS NULL FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!anterior) {
        throw new ApiError(404, "USUARIO_NO_ENCONTRADO", "Usuario inexistente");
      }

      const cambiaRol = input.rol !== undefined && input.rol !== anterior.rol;
      const seDesactiva = input.activo === false && anterior.activo;
      const cambiaClave = input.password !== undefined;
      const pierdeAdmin =
        anterior.rol === "admin" &&
        ((cambiaRol && input.rol !== "admin") || seDesactiva);

      if (id === sesion.id && ((cambiaRol && input.rol !== "admin") || seDesactiva)) {
        throw new ApiError(
          400,
          "OPERACION_NO_PERMITIDA",
          "No podés quitarte tu propio rol admin ni desactivarte",
        );
      }
      if (pierdeAdmin && (await otrosAdmins(client, id)) === 0) {
        throw new ApiError(
          400,
          "ULTIMO_ADMIN",
          "Debe existir al menos un administrador activo",
        );
      }

      const set: string[] = [];
      const values: unknown[] = [];
      let n = 1;
      const add = (sql: string, value: unknown) => {
        set.push(sql.replace("$#", `$${n}`));
        values.push(value);
        n += 1;
      };

      if (input.nombre !== undefined) add("nombre=$#", input.nombre);
      if (input.email !== undefined) add("email=$#", input.email);
      if (input.rol !== undefined) add("rol=$#", input.rol);
      if (input.activo !== undefined) add("activo=$#", input.activo);
      if (cambiaClave) add("password_hash=$#", await bcrypt.hash(input.password!, 12));
      if (cambiaClave || cambiaRol || seDesactiva) set.push("token_version=token_version+1");
      set.push("actualizado_en=now()");

      const actualizada = (
        await client.query<Usuario>(
          `UPDATE usuarios SET ${set.join(", ")} WHERE id=$${n}
           RETURNING id,nombre,email,rol,activo,token_version,debe_cambiar_password`,
          [...values, id],
        )
      ).rows[0];

      await auditar(client, {
        usuarioId: sesion.id,
        accion: "UPDATE",
        tabla: "usuarios",
        registroId: id,
        antes: anterior,
        despues: { ...actualizada, password_cambiada: cambiaClave },
        ip,
      });

      return actualizada;
    });

    return NextResponse.json({ usuario });
  } catch (error) {
    if (emailDuplicado(error)) {
      return NextResponse.json(
        { error: "El email ya está registrado", code: "EMAIL_DUPLICADO" },
        { status: 409 },
      );
    }
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const sesion = await requireApiUser(["admin"], "usuarios.manage");
    assertSameOrigin(request);
    const id = userIdSchema.parse((await context.params).id);
    const ip = clientIp(request);

    const usuario = await withTransaction(async (client) => {
      const anterior = (
        await client.query<Usuario>(
          `SELECT id,nombre,email,rol,activo,token_version,debe_cambiar_password FROM usuarios
            WHERE id=$1 AND eliminado_en IS NULL FOR UPDATE`,
          [id],
        )
      ).rows[0];
      if (!anterior) {
        throw new ApiError(404, "USUARIO_NO_ENCONTRADO", "Usuario inexistente");
      }
      if (id === sesion.id) {
        throw new ApiError(
          400,
          "OPERACION_NO_PERMITIDA",
          "No podés eliminar tu propio usuario",
        );
      }
      if (anterior.rol === "admin" && (await otrosAdmins(client, id)) === 0) {
        throw new ApiError(
          400,
          "ULTIMO_ADMIN",
          "Debe existir al menos un administrador activo",
        );
      }

      const eliminado = (
        await client.query<Usuario>(
          `UPDATE usuarios
              SET eliminado_en=now(), activo=false,
                  token_version=token_version+1, actualizado_en=now()
            WHERE id=$1
            RETURNING id,nombre,email,rol,activo,token_version`,
          [id],
        )
      ).rows[0];

      await auditar(client, {
        usuarioId: sesion.id,
        accion: "DELETE",
        tabla: "usuarios",
        registroId: id,
        antes: anterior,
        despues: { eliminado_logico: true },
        ip,
      });
      return eliminado;
    });

    return NextResponse.json({ usuario });
  } catch (error) {
    return errorResponse(error);
  }
}

