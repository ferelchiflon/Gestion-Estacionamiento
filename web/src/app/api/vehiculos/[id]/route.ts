import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { vehiculoUpdateSchema } from "@/lib/validations/modulo2";
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
    await requireApiUser(["admin", "operador", "contador"], "clientes.read");
    const { id } = await params;
    const vehiculoId = Number(id);

    if (isNaN(vehiculoId) || vehiculoId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de vehículo inválido");
    }

    const pool = getPool();
    const vehiculoRes = await pool.query(
      `SELECT v.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.documento as cliente_documento
       FROM vehiculos v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.id = $1 AND v.eliminado_en IS NULL`,
      [vehiculoId]
    );

    if (vehiculoRes.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Vehículo no encontrado");
    }

    const vehiculo = vehiculoRes.rows[0];

    // Historial de últimos movimientos
    const movimientosRes = await pool.query(
      `SELECT m.*, p.numero as plaza_numero
       FROM movimientos m
       LEFT JOIN plazas p ON m.plaza_id = p.id
       WHERE m.patente = $1 AND m.eliminado_en IS NULL
       ORDER BY m.hora_entrada DESC
       LIMIT 10`,
      [vehiculo.patente]
    );

    // Deuda si el cliente asociado tiene
    let deudaTotal = 0;
    if (vehiculo.cliente_id) {
      const deudaRes = await pool.query(
        `SELECT sum(monto_con_interes)::numeric(14,2) as total
         FROM deudas
         WHERE cliente_id = $1 AND estado = 'pendiente' AND eliminado_en IS NULL`,
        [vehiculo.cliente_id]
      );
      deudaTotal = Number(deudaRes.rows[0]?.total ?? 0);
    }

    return Response.json({
      vehiculo,
      movimientos: movimientosRes.rows,
      deudaTotal,
    });
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
    const user = await requireApiUser(["admin", "operador"], "clientes.write");
    const { id } = await params;
    const vehiculoId = Number(id);

    if (isNaN(vehiculoId) || vehiculoId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de vehículo inválido");
    }

    const body = await request.json();
    const data = vehiculoUpdateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        `SELECT * FROM vehiculos WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [vehiculoId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Vehículo no encontrado");
      }

      const anterior = existingRes.rows[0];

      // Si cambia de patente, verificar que no choque con otra
      if (data.patente && data.patente !== anterior.patente) {
        const checkDupl = await client.query(
          "SELECT id FROM vehiculos WHERE patente = $1 AND id <> $2 AND eliminado_en IS NULL",
          [data.patente, vehiculoId]
        );
        if (checkDupl.rowCount && checkDupl.rowCount > 0) {
          throw new ApiError(409, "PATENTE_DUPLICADA", `La patente ${data.patente} ya pertenece a otro vehículo`);
        }
      }

      const sets: string[] = [];
      const values: unknown[] = [];

      if (data.patente !== undefined) {
        values.push(data.patente);
        sets.push(`patente = $${values.length}`);
      }
      if (data.tipo !== undefined) {
        values.push(data.tipo);
        sets.push(`tipo = $${values.length}`);
      }
      if (data.marca !== undefined) {
        values.push(data.marca || null);
        sets.push(`marca = $${values.length}`);
      }
      if (data.modelo !== undefined) {
        values.push(data.modelo || null);
        sets.push(`modelo = $${values.length}`);
      }
      if (data.color !== undefined) {
        values.push(data.color || null);
        sets.push(`color = $${values.length}`);
      }
      if (data.cliente_id !== undefined) {
        values.push(data.cliente_id || null);
        sets.push(`cliente_id = $${values.length}`);
      }

      values.push(vehiculoId);
      const updateSql = `
        UPDATE vehiculos
        SET ${sets.join(", ")}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const updateRes = await client.query(updateSql, values);
      const vehiculoActualizado = updateRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "UPDATE",
        tabla: "vehiculos",
        registroId: vehiculoId,
        antes: anterior,
        despues: vehiculoActualizado,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(vehiculoActualizado);
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
    const user = await requireApiUser(["admin", "operador"], "clientes.write");
    const { id } = await params;
    const vehiculoId = Number(id);

    if (isNaN(vehiculoId) || vehiculoId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de vehículo inválido");
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        `SELECT * FROM vehiculos WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [vehiculoId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Vehículo no encontrado");
      }

      const anterior = existingRes.rows[0];

      // Verificación de integridad: no eliminar si tiene un movimiento activo (estacionado)
      const movimientoActivo = await client.query(
        `SELECT count(*)::int as count FROM movimientos 
         WHERE patente = $1 AND hora_salida IS NULL AND eliminado_en IS NULL`,
        [anterior.patente]
      );
      if (movimientoActivo.rows[0]?.count > 0) {
        throw new ApiError(400, "VEHICULO_ESTACIONADO", "No se puede eliminar un vehículo que se encuentra estacionado actualmente");
      }

      // Baja lógica
      const deleteRes = await client.query(
        `UPDATE vehiculos
         SET eliminado_en = now()
         WHERE id = $1
         RETURNING *`,
        [vehiculoId]
      );

      await auditar(client, {
        usuarioId: user.id,
        accion: "DELETE",
        tabla: "vehiculos",
        registroId: vehiculoId,
        antes: anterior,
        despues: deleteRes.rows[0],
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json({ success: true, message: "Vehículo dado de baja lógicamente" });
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
