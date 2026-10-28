import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import {
  ingresoSchema,
  movimientosQuerySchema,
} from "@/lib/validations/modulo4";
import { obtenerTarifaVigente } from "@/lib/tarifas";
import { calcularMontoEstadia } from "@/lib/calculo-estadia";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = movimientosQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const { q, activos_only, fecha_desde, fecha_hasta, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const pool = getPool();
    const conditions: string[] = ["m.eliminado_en IS NULL"];
    const params: unknown[] = [];

    if (activos_only) {
      conditions.push("m.hora_salida IS NULL");
    }

    if (fecha_desde) {
      params.push(`${fecha_desde} 00:00:00-03`);
      conditions.push(`m.hora_entrada >= $${params.length}::timestamptz`);
    }

    if (fecha_hasta) {
      params.push(`${fecha_hasta} 23:59:59.999-03`);
      conditions.push(`m.hora_entrada <= $${params.length}::timestamptz`);
    }

    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      conditions.push(`(m.patente ILIKE $${idx} OR c.nombre ILIKE $${idx} OR p.numero ILIKE $${idx})`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countSql = `
      SELECT count(*)::int as total
      FROM movimientos m
      LEFT JOIN vehiculos v ON m.patente = v.patente AND v.eliminado_en IS NULL
      LEFT JOIN clientes c ON v.cliente_id = c.id
      JOIN plazas p ON m.plaza_id = p.id
      ${whereClause}
    `;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows[0]?.total ?? 0;

    const queryParams = [...params, limit, offset];
    const dataSql = `
      SELECT 
        m.id,
        m.patente,
        m.plaza_id,
        p.numero as plaza_numero,
        p.sector as plaza_sector,
        m.hora_entrada,
        m.hora_salida,
        m.monto_calculado,
        m.monto_pagado,
        m.estado_pago,
        m.forma_pago,
        v.tipo as vehiculo_tipo,
        v.marca as vehiculo_marca,
        v.modelo as vehiculo_modelo,
        c.id as cliente_id,
        c.nombre as cliente_nombre,
        c.saldo_actual as cliente_saldo,
        r.id as recibo_id,
        r.numero as recibo_numero
      FROM movimientos m
      JOIN plazas p ON m.plaza_id = p.id
      LEFT JOIN vehiculos v ON m.patente = v.patente AND v.eliminado_en IS NULL
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN recibos r ON r.movimiento_id = m.id AND r.eliminado_en IS NULL
      ${whereClause}
      ORDER BY 
        CASE WHEN m.hora_salida IS NULL THEN 0 ELSE 1 END ASC,
        m.hora_entrada DESC
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
    `;

    const dataRes = await pool.query(dataSql, queryParams);

    // Enriquecer movimientos activos con cálculo de tiempo y costo acumulado en el servidor
    const ahora = new Date();
    const rowsWithEstimate = await Promise.all(
      dataRes.rows.map(async (row) => {
        if (row.hora_salida === null) {
          const tipo = row.vehiculo_tipo || "auto";
          const tarifa = await obtenerTarifaVigente(tipo, ahora);
          const centavos = tarifa?.tarifa_hora_centavos ?? 150000;
          const calc = calcularMontoEstadia(row.hora_entrada, ahora, centavos);
          return {
            ...row,
            tiempo_transcurrido_minutos: calc.minutosTotales,
            horas_estimadas: calc.horasCobrables,
            monto_estimado: calc.montoTotalPesos,
            tarifa_hora_aplicada: calc.tarifaHoraCentavos / 100,
          };
        }
        return row;
      })
    );

    return Response.json({
      data: rowsWithEstimate,
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
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");

    const body = await request.json();
    const data = ingresoSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Tomar la plaza con SELECT ... FOR UPDATE
      const plazaRes = await client.query(
        "SELECT id, numero, sector, tipo_vehiculo, estado FROM plazas WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
        [data.plaza_id]
      );

      if (plazaRes.rowCount === 0) {
        throw new ApiError(404, "PLAZA_NO_ENCONTRADA", "La plaza especificada no existe");
      }

      const plaza = plazaRes.rows[0];

      // 2. Verificar que esté libre
      if (plaza.estado !== "libre") {
        throw new ApiError(409, "PLAZA_OCUPADA", `La plaza ${plaza.numero} no está libre (estado: ${plaza.estado})`);
      }

      // 3. Regla: Una patente no puede tener dos movimientos abiertos simultáneos
      const abiertoRes = await client.query(
        "SELECT id, plaza_id FROM movimientos WHERE patente = $1 AND hora_salida IS NULL AND eliminado_en IS NULL FOR UPDATE",
        [data.patente]
      );

      if (abiertoRes.rowCount && abiertoRes.rowCount > 0) {
        throw new ApiError(
          409,
          "PATENTE_CON_MOVIMIENTO_ABIERTO",
          `El vehículo con patente ${data.patente} ya tiene un ingreso abierto en la plaza ID ${abiertoRes.rows[0].plaza_id}`
        );
      }

      // Si el vehículo no existe en catálogo, registrarlo o asociarlo
      const vehiculoExistente = await client.query(
        "SELECT id, cliente_id, tipo FROM vehiculos WHERE patente = $1 AND eliminado_en IS NULL",
        [data.patente]
      );

      let clienteId = data.cliente_id ?? null;

      if (vehiculoExistente.rowCount && vehiculoExistente.rowCount > 0) {
        if (!clienteId && vehiculoExistente.rows[0].cliente_id) {
          clienteId = vehiculoExistente.rows[0].cliente_id;
        }
      } else {
        // Crear vehículo nuevo automáticamente si no existía
        await client.query(
          `INSERT INTO vehiculos (patente, tipo, marca, modelo, color, cliente_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (patente) DO UPDATE 
           SET eliminado_en = NULL, tipo = EXCLUDED.tipo, marca = COALESCE(EXCLUDED.marca, vehiculos.marca)`,
          [
            data.patente,
            data.tipo_vehiculo,
            data.marca || null,
            data.modelo || null,
            data.color || null,
            clienteId,
          ]
        );
      }

      // 4. Insertar el movimiento
      const insertMovRes = await client.query(
        `INSERT INTO movimientos (patente, plaza_id, hora_entrada, estado_pago)
         VALUES ($1, $2, now(), 'pendiente')
         RETURNING *`,
        [data.patente, data.plaza_id]
      );
      const nuevoMovimiento = insertMovRes.rows[0];

      // 5. Poner la plaza en 'ocupada'
      await client.query(
        "UPDATE plazas SET estado = 'ocupada' WHERE id = $1",
        [data.plaza_id]
      );

      // 6. Auditar
      await auditar(client, {
        usuarioId: user.id,
        accion: "INSERT",
        tabla: "movimientos",
        registroId: nuevoMovimiento.id,
        despues: nuevoMovimiento,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(nuevoMovimiento, { status: 201 });
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
