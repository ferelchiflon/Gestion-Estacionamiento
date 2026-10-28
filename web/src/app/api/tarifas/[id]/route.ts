import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { tarifaUpdateSchema } from "@/lib/validations/modulo3";
import { verificarSolapamientoTarifa } from "@/lib/tarifas";
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
    await requireApiUser(["admin", "operador", "contador"], "tarifas.read");
    const { id } = await params;
    const tarifaId = Number(id);

    if (isNaN(tarifaId) || tarifaId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de tarifa inválido");
    }

    const pool = getPool();
    const res = await pool.query(
      `SELECT 
        id,
        tipo_vehiculo,
        tarifa_hora::numeric(14,2) AS tarifa_hora,
        to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
        to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta
       FROM tarifas
       WHERE id = $1 AND eliminado_en IS NULL`,
      [tarifaId]
    );

    if (res.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Tarifa no encontrada");
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
    const user = await requireApiUser(["admin"], "tarifas.write");
    const { id } = await params;
    const tarifaId = Number(id);

    if (isNaN(tarifaId) || tarifaId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de tarifa inválido");
    }

    const body = await request.json();
    const data = tarifaUpdateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        `SELECT 
          id,
          tipo_vehiculo,
          tarifa_hora::numeric(14,2) as tarifa_hora,
          to_char(fecha_desde, 'YYYY-MM-DD') as fecha_desde,
          to_char(fecha_hasta, 'YYYY-MM-DD') as fecha_hasta
         FROM tarifas
         WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [tarifaId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Tarifa no encontrada");
      }

      const anterior = existingRes.rows[0];

      const nuevaFechaDesde = data.fecha_desde ?? anterior.fecha_desde;
      const nuevaFechaHasta = data.fecha_hasta !== undefined ? data.fecha_hasta : anterior.fecha_hasta;

      if (nuevaFechaHasta && nuevaFechaHasta < nuevaFechaDesde) {
        throw new ApiError(400, "FECHAS_INVALIDAS", "La fecha hasta no puede ser menor a la fecha desde");
      }

      // Validar solapamientos con otras tarifas del mismo tipo
      const solapa = await verificarSolapamientoTarifa(
        anterior.tipo_vehiculo,
        nuevaFechaDesde,
        nuevaFechaHasta,
        tarifaId,
        client
      );

      if (solapa) {
        throw new ApiError(
          409,
          "TARIFA_SOLAPADA",
          `El rango indicado se solapa con otra tarifa existente para ${anterior.tipo_vehiculo}`
        );
      }

      const sets: string[] = [];
      const values: unknown[] = [];

      if (data.tarifa_hora !== undefined) {
        values.push(data.tarifa_hora);
        sets.push(`tarifa_hora = $${values.length}`);
      }
      if (data.fecha_desde !== undefined) {
        values.push(data.fecha_desde);
        sets.push(`fecha_desde = $${values.length}::date`);
      }
      if (data.fecha_hasta !== undefined) {
        values.push(data.fecha_hasta || null);
        sets.push(`fecha_hasta = $${values.length}::date`);
      }

      values.push(tarifaId);
      const updateSql = `
        UPDATE tarifas
        SET ${sets.join(", ")}
        WHERE id = $${values.length}
        RETURNING id, tipo_vehiculo, tarifa_hora::numeric(14,2), to_char(fecha_desde, 'YYYY-MM-DD') as fecha_desde, to_char(fecha_hasta, 'YYYY-MM-DD') as fecha_hasta
      `;

      const updateRes = await client.query(updateSql, values);
      const tarifaActualizada = updateRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "UPDATE",
        tabla: "tarifas",
        registroId: tarifaId,
        antes: anterior,
        despues: tarifaActualizada,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(tarifaActualizada);
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
    const user = await requireApiUser(["admin"], "tarifas.write");
    const { id } = await params;
    const tarifaId = Number(id);

    if (isNaN(tarifaId) || tarifaId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de tarifa inválido");
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        "SELECT * FROM tarifas WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
        [tarifaId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Tarifa no encontrada");
      }

      const anterior = existingRes.rows[0];

      const deleteRes = await client.query(
        `UPDATE tarifas
         SET eliminado_en = now()
         WHERE id = $1
         RETURNING id`,
        [tarifaId]
      );

      await auditar(client, {
        usuarioId: user.id,
        accion: "DELETE",
        tabla: "tarifas",
        registroId: tarifaId,
        antes: anterior,
        despues: deleteRes.rows[0],
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json({ success: true, message: "Tarifa dada de baja lógicamente" });
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
