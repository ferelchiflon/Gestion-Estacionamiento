import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import {
  clienteCreateSchema,
  clienteQuerySchema,
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
    const parsed = clienteQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros de búsqueda inválidos", parsed.error.issues);
    }

    const { q, page, limit, estado } = parsed.data;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const conditions: string[] = ["c.eliminado_en IS NULL"];
    const params: unknown[] = [];

    if (estado !== "todos") {
      params.push(estado);
      conditions.push(`c.estado = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      conditions.push(`(c.nombre ILIKE $${idx} OR c.documento ILIKE $${idx} OR c.email ILIKE $${idx} OR c.telefono ILIKE $${idx})`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT count(*)::int as total FROM clientes c ${whereClause}`;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows[0]?.total ?? 0;

    const queryParams = [...params, limit, offset];
    const dataSql = `
      SELECT 
        c.id,
        c.nombre,
        c.documento,
        c.email,
        c.telefono,
        c.saldo_actual,
        c.estado,
        c.fecha_registro,
        COALESCE((
          SELECT sum(d.monto_con_interes)
          FROM deudas d
          WHERE d.cliente_id = c.id 
            AND d.estado = 'pendiente' 
            AND d.eliminado_en IS NULL
        ), 0)::numeric(14,2) AS deuda_total,
        (
          SELECT count(*)::int
          FROM vehiculos v
          WHERE v.cliente_id = c.id 
            AND v.eliminado_en IS NULL
        ) AS cantidad_vehiculos
      FROM clientes c
      ${whereClause}
      ORDER BY c.nombre ASC
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
    const data = clienteCreateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insertRes = await client.query(
        `INSERT INTO clientes (nombre, documento, email, telefono, saldo_actual, estado)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.nombre,
          data.documento || null,
          data.email || null,
          data.telefono || null,
          data.saldo_actual,
          data.estado,
        ]
      );

      const nuevoCliente = insertRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "INSERT",
        tabla: "clientes",
        registroId: nuevoCliente.id,
        despues: nuevoCliente,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(nuevoCliente, { status: 201 });
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
