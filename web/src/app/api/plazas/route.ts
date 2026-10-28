import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import {
  plazaCreateSchema,
  plazaQuerySchema,
} from "@/lib/validations/modulo3";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "plazas.read");

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = plazaQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const { sector, tipo_vehiculo, estado } = parsed.data;

    const pool = getPool();
    const conditions: string[] = ["p.eliminado_en IS NULL"];
    const params: unknown[] = [];

    if (sector) {
      params.push(sector.toUpperCase());
      conditions.push(`p.sector = $${params.length}`);
    }

    if (tipo_vehiculo !== "todos") {
      params.push(tipo_vehiculo);
      conditions.push(`p.tipo_vehiculo = $${params.length}`);
    }

    if (estado !== "todos") {
      params.push(estado);
      conditions.push(`p.estado = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        p.id,
        p.numero,
        p.sector,
        p.tipo_vehiculo,
        p.estado,
        m.patente as movimiento_patente,
        m.hora_entrada as movimiento_hora_entrada,
        c.id as contrato_id,
        cl.nombre as contrato_cliente_nombre
      FROM plazas p
      LEFT JOIN movimientos m ON m.plaza_id = p.id AND m.hora_salida IS NULL AND m.eliminado_en IS NULL
      LEFT JOIN contratos_alquiler c ON c.plaza_id = p.id AND c.estado = 'activo' AND c.eliminado_en IS NULL
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      ${whereClause}
      ORDER BY p.sector ASC, p.numero ASC
    `;

    const res = await pool.query(sql, params);

    // Resumen por estado
    const resumenSql = `
      SELECT estado, count(*)::int as cantidad
      FROM plazas
      WHERE eliminado_en IS NULL
      GROUP BY estado
    `;
    const resumenRes = await pool.query(resumenSql);
    const resumen = {
      libre: 0,
      ocupada: 0,
      mantenimiento: 0,
      total: 0,
    };
    for (const r of resumenRes.rows) {
      if (r.estado in resumen) {
        resumen[r.estado as keyof typeof resumen] = r.cantidad;
      }
      resumen.total += r.cantidad;
    }

    return Response.json({
      data: res.rows,
      resumen,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin"], "plazas.write");

    const body = await request.json();
    const data = plazaCreateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verificar si ya existe una plaza con ese número
      const existing = await client.query(
        "SELECT id, eliminado_en FROM plazas WHERE numero = $1",
        [data.numero]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const row = existing.rows[0];
        if (row.eliminado_en === null) {
          throw new ApiError(409, "PLAZA_DUPLICADA", `La plaza ${data.numero} ya existe`);
        } else {
          // Reactivar si estaba borrada lógicamente
          const restoreRes = await client.query(
            `UPDATE plazas
             SET sector = $1, tipo_vehiculo = $2, estado = $3, eliminado_en = NULL
             WHERE id = $4
             RETURNING *`,
            [data.sector, data.tipo_vehiculo, data.estado, row.id]
          );
          const reactivada = restoreRes.rows[0];

          await auditar(client, {
            usuarioId: user.id,
            accion: "UPDATE",
            tabla: "plazas",
            registroId: reactivada.id,
            antes: row,
            despues: reactivada,
            ip: clientIp(request),
          });

          await client.query("COMMIT");
          return Response.json(reactivada, { status: 201 });
        }
      }

      const insertRes = await client.query(
        `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.numero, data.sector, data.tipo_vehiculo, data.estado]
      );

      const nuevaPlaza = insertRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "INSERT",
        tabla: "plazas",
        registroId: nuevaPlaza.id,
        despues: nuevaPlaza,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(nuevaPlaza, { status: 201 });
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
