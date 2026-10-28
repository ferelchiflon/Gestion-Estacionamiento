import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { plazaUpdateSchema } from "@/lib/validations/modulo3";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "plazas.read");
    const { id } = await params;
    const plazaId = Number(id);

    if (isNaN(plazaId) || plazaId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de plaza inválido");
    }

    const pool = getPool();
    const res = await pool.query(
      `SELECT p.*,
              m.patente as movimiento_patente,
              m.hora_entrada as movimiento_hora_entrada
       FROM plazas p
       LEFT JOIN movimientos m ON m.plaza_id = p.id AND m.hora_salida IS NULL AND m.eliminado_en IS NULL
       WHERE p.id = $1 AND p.eliminado_en IS NULL`,
      [plazaId]
    );

    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Plaza no encontrada");
    }

    return Response.json(res.rows[0]);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin"], "plazas.write");
    const { id } = await params;
    const plazaId = Number(id);

    if (isNaN(plazaId) || plazaId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de plaza inválido");
    }

    const body = await request.json();
    const data = plazaUpdateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        "SELECT * FROM plazas WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
        [plazaId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Plaza no encontrada");
      }

      const anterior = existingRes.rows[0];

      // Si cambia de número, verificar unicidad
      if (data.numero && data.numero !== anterior.numero) {
        const checkDupl = await client.query(
          "SELECT id FROM plazas WHERE numero = $1 AND id <> $2 AND eliminado_en IS NULL",
          [data.numero, plazaId]
        );
        if (checkDupl.rowCount && checkDupl.rowCount > 0) {
          throw new ApiError(409, "PLAZA_DUPLICADA", `La plaza número ${data.numero} ya existe`);
        }
      }

      // Si la plaza está ocupada por un movimiento real, no permitir pasarla a 'libre' o 'mantenimiento' sin liberar el movimiento
      if (data.estado && data.estado !== anterior.estado) {
        const movActivo = await client.query(
          "SELECT id FROM movimientos WHERE plaza_id = $1 AND hora_salida IS NULL AND eliminado_en IS NULL",
          [plazaId]
        );
        if (movActivo.rowCount && movActivo.rowCount > 0 && data.estado === "libre") {
          throw new ApiError(400, "PLAZA_TIENE_MOVIMIENTO", "No se puede liberar manualmente una plaza con vehículo activo estacionado");
        }
      }

      const sets: string[] = [];
      const values: unknown[] = [];

      if (data.numero !== undefined) {
        values.push(data.numero);
        sets.push(`numero = $${values.length}`);
      }
      if (data.sector !== undefined) {
        values.push(data.sector);
        sets.push(`sector = $${values.length}`);
      }
      if (data.tipo_vehiculo !== undefined) {
        values.push(data.tipo_vehiculo);
        sets.push(`tipo_vehiculo = $${values.length}`);
      }
      if (data.estado !== undefined) {
        values.push(data.estado);
        sets.push(`estado = $${values.length}`);
      }

      values.push(plazaId);
      const updateSql = `
        UPDATE plazas
        SET ${sets.join(", ")}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const updateRes = await client.query(updateSql, values);
      const plazaActualizada = updateRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "UPDATE",
        tabla: "plazas",
        registroId: plazaId,
        antes: anterior,
        despues: plazaActualizada,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(plazaActualizada);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin"], "plazas.write");
    const { id } = await params;
    const plazaId = Number(id);

    if (isNaN(plazaId) || plazaId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de plaza inválido");
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        "SELECT * FROM plazas WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
        [plazaId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Plaza no encontrada");
      }

      const anterior = existingRes.rows[0];

      // Verificación de integridad: no borrar si tiene un auto adentro
      const movActivo = await client.query(
        "SELECT id FROM movimientos WHERE plaza_id = $1 AND hora_salida IS NULL AND eliminado_en IS NULL",
        [plazaId]
      );
      if (movActivo.rowCount && movActivo.rowCount > 0) {
        throw new ApiError(400, "PLAZA_OCUPADA", "No se puede eliminar una plaza que se encuentra ocupada");
      }

      // Verificación de integridad: no borrar si tiene contrato de alquiler activo
      const contratoActivo = await client.query(
        "SELECT id FROM contratos_alquiler WHERE plaza_id = $1 AND estado = 'activo' AND eliminado_en IS NULL",
        [plazaId]
      );
      if (contratoActivo.rowCount && contratoActivo.rowCount > 0) {
        throw new ApiError(400, "PLAZA_CON_CONTRATO", "No se puede eliminar una plaza con contratos de alquiler vigentes");
      }

      // Baja lógica
      const deleteRes = await client.query(
        `UPDATE plazas
         SET eliminado_en = now()
         WHERE id = $1
         RETURNING *`,
        [plazaId]
      );

      await auditar(client, {
        usuarioId: user.id,
        accion: "DELETE",
        tabla: "plazas",
        registroId: plazaId,
        antes: anterior,
        despues: deleteRes.rows[0],
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json({ success: true, message: "Plaza dada de baja lógicamente" });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(error);
  }
}
