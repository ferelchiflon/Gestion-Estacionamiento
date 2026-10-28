import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { clienteUpdateSchema } from "@/lib/validations/modulo2";
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
    const clienteId = Number(id);

    if (isNaN(clienteId) || clienteId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de cliente inválido");
    }

    const pool = getPool();

    // 1. Datos del cliente
    const clienteRes = await pool.query(
      `SELECT * FROM clientes WHERE id = $1 AND eliminado_en IS NULL`,
      [clienteId]
    );

    if (clienteRes.rowCount === 0) {
      throw new ApiError(404, "NOT_FOUND", "Cliente no encontrado");
    }

    const cliente = clienteRes.rows[0];

    // 2. Vehículos del cliente
    const vehiculosRes = await pool.query(
      `SELECT * FROM vehiculos 
       WHERE cliente_id = $1 AND eliminado_en IS NULL
       ORDER BY patente ASC`,
      [clienteId]
    );

    // 3. Deudas del cliente
    const deudasRes = await pool.query(
      `SELECT d.*, m.patente, m.hora_entrada, m.hora_salida
       FROM deudas d
       LEFT JOIN movimientos m ON d.movimiento_id = m.id
       WHERE d.cliente_id = $1 AND d.eliminado_en IS NULL
       ORDER BY d.created_at DESC`,
      [clienteId]
    );

    // 4. Contratos de alquiler del cliente
    const contratosRes = await pool.query(
      `SELECT c.*, p.numero as plaza_numero, p.sector as plaza_sector, t.nombre as tipo_alquiler_nombre
       FROM contratos_alquiler c
       JOIN plazas p ON c.plaza_id = p.id
       LEFT JOIN tipos_alquiler t ON c.tipo_alquiler_id = t.id
       WHERE c.cliente_id = $1 AND c.eliminado_en IS NULL
       ORDER BY c.fecha_inicio DESC`,
      [clienteId]
    );

    const deudaTotal = deudasRes.rows
      .filter((d) => d.estado === "pendiente")
      .reduce((sum, d) => sum + Number(d.monto_con_interes), 0);

    return Response.json({
      cliente,
      vehiculos: vehiculosRes.rows,
      deudas: deudasRes.rows,
      deudaTotal,
      contratos: contratosRes.rows,
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
    const clienteId = Number(id);

    if (isNaN(clienteId) || clienteId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de cliente inválido");
    }

    const body = await request.json();
    const data = clienteUpdateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        `SELECT * FROM clientes WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [clienteId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Cliente no encontrado");
      }

      const anterior = existingRes.rows[0];

      const sets: string[] = [];
      const values: unknown[] = [];

      if (data.nombre !== undefined) {
        values.push(data.nombre);
        sets.push(`nombre = $${values.length}`);
      }
      if (data.documento !== undefined) {
        values.push(data.documento || null);
        sets.push(`documento = $${values.length}`);
      }
      if (data.email !== undefined) {
        values.push(data.email || null);
        sets.push(`email = $${values.length}`);
      }
      if (data.telefono !== undefined) {
        values.push(data.telefono || null);
        sets.push(`telefono = $${values.length}`);
      }
      if (data.saldo_actual !== undefined) {
        values.push(data.saldo_actual);
        sets.push(`saldo_actual = $${values.length}`);
      }
      if (data.estado !== undefined) {
        values.push(data.estado);
        sets.push(`estado = $${values.length}`);
      }

      values.push(clienteId);
      const updateSql = `
        UPDATE clientes
        SET ${sets.join(", ")}
        WHERE id = $${values.length}
        RETURNING *
      `;

      const updateRes = await client.query(updateSql, values);
      const clienteActualizado = updateRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "UPDATE",
        tabla: "clientes",
        registroId: clienteId,
        antes: anterior,
        despues: clienteActualizado,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(clienteActualizado);
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
    const clienteId = Number(id);

    if (isNaN(clienteId) || clienteId <= 0) {
      throw new ApiError(400, "INVALID_ID", "ID de cliente inválido");
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query(
        `SELECT * FROM clientes WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE`,
        [clienteId]
      );

      if (existingRes.rowCount === 0) {
        throw new ApiError(404, "NOT_FOUND", "Cliente no encontrado");
      }

      const anterior = existingRes.rows[0];

      // Verificación de integridad: si tiene deudas pendientes no se puede borrar
      const deudasPendientes = await client.query(
        `SELECT count(*)::int as count FROM deudas 
         WHERE cliente_id = $1 AND estado = 'pendiente' AND eliminado_en IS NULL`,
        [clienteId]
      );
      if (deudasPendientes.rows[0]?.count > 0) {
        throw new ApiError(400, "HAS_PENDING_DEBTS", "No se puede eliminar un cliente con deudas pendientes");
      }

      // Verificación de contratos activos
      const contratosActivos = await client.query(
        `SELECT count(*)::int as count FROM contratos_alquiler 
         WHERE cliente_id = $1 AND estado = 'activo' AND eliminado_en IS NULL`,
        [clienteId]
      );
      if (contratosActivos.rows[0]?.count > 0) {
        throw new ApiError(400, "HAS_ACTIVE_CONTRACTS", "No se puede eliminar un cliente con contratos vigentes activos");
      }

      // Baja lógica
      const deleteRes = await client.query(
        `UPDATE clientes
         SET eliminado_en = now(), estado = 'inactivo'
         WHERE id = $1
         RETURNING *`,
        [clienteId]
      );

      await auditar(client, {
        usuarioId: user.id,
        accion: "DELETE",
        tabla: "clientes",
        registroId: clienteId,
        antes: anterior,
        despues: deleteRes.rows[0],
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json({ success: true, message: "Cliente dado de baja lógicamente" });
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
