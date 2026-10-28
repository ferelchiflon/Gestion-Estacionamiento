import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { normalizarPatente } from "@/lib/format";
import {
  vehiculoCreateSchema,
  vehiculoQuerySchema,
} from "@/lib/validations/modulo2";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "clientes.read");

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = vehiculoQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros de búsqueda inválidos", parsed.error.issues);
    }

    const { q, tipo, page, limit, cliente_id } = parsed.data;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const conditions: string[] = ["v.eliminado_en IS NULL"];
    const params: unknown[] = [];

    if (tipo !== "todos") {
      params.push(tipo);
      conditions.push(`v.tipo = $${params.length}`);
    }

    if (cliente_id) {
      params.push(cliente_id);
      conditions.push(`v.cliente_id = $${params.length}`);
    }

    if (q) {
      const qNorm = normalizarPatente(q);
      params.push(`%${qNorm}%`);
      const pIdx = params.length;
      params.push(`%${q}%`);
      const tIdx = params.length;
      conditions.push(`(v.patente ILIKE $${pIdx} OR v.marca ILIKE $${tIdx} OR v.modelo ILIKE $${tIdx} OR c.nombre ILIKE $${tIdx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT count(*)::int as total 
      FROM vehiculos v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      ${whereClause}
    `;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows[0]?.total ?? 0;

    const queryParams = [...params, limit, offset];
    const dataSql = `
      SELECT 
        v.id,
        v.patente,
        v.tipo,
        v.marca,
        v.modelo,
        v.color,
        v.cliente_id,
        v.created_at,
        c.nombre as cliente_nombre,
        c.telefono as cliente_telefono,
        COALESCE((
          SELECT sum(d.monto_con_interes)
          FROM deudas d
          WHERE d.cliente_id = v.cliente_id 
            AND d.estado = 'pendiente' 
            AND d.eliminado_en IS NULL
        ), 0)::numeric(14,2) AS cliente_deuda_total
      FROM vehiculos v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const dataRes = await pool.query(dataSql, queryParams);

    return Response.json({
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin", "operador"], "clientes.write");

    const body = await request.json();
    const data = vehiculoCreateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verificar si la patente ya existe y no está eliminada
      const existing = await client.query(
        "SELECT id, eliminado_en FROM vehiculos WHERE patente = $1",
        [data.patente]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const row = existing.rows[0];
        if (row.eliminado_en === null) {
          throw new ApiError(409, "PATENTE_DUPLICADA", `El vehículo con patente ${data.patente} ya está registrado`);
        } else {
          // Si estaba eliminado lógicamente, lo reactivamos con los nuevos datos
          const restoreRes = await client.query(
            `UPDATE vehiculos
             SET tipo = $1, marca = $2, modelo = $3, color = $4, cliente_id = $5, eliminado_en = NULL
             WHERE id = $6
             RETURNING *`,
            [
              data.tipo,
              data.marca || null,
              data.modelo || null,
              data.color || null,
              data.cliente_id || null,
              row.id,
            ]
          );
          const reactivado = restoreRes.rows[0];

          await auditar(client, {
            usuarioId: user.id,
            accion: "UPDATE",
            tabla: "vehiculos",
            registroId: reactivado.id,
            antes: row,
            despues: reactivado,
            ip: clientIp(request),
          });

          await client.query("COMMIT");
          return Response.json(reactivado, { status: 201 });
        }
      }

      // Inserción normal
      const insertRes = await client.query(
        `INSERT INTO vehiculos (patente, tipo, marca, modelo, color, cliente_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.patente,
          data.tipo,
          data.marca || null,
          data.modelo || null,
          data.color || null,
          data.cliente_id || null,
        ]
      );

      const nuevoVehiculo = insertRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "INSERT",
        tabla: "vehiculos",
        registroId: nuevoVehiculo.id,
        despues: nuevoVehiculo,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(nuevoVehiculo, { status: 201 });
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
