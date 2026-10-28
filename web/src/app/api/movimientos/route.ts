import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { registrarIngreso } from "@/lib/movimientos";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";
import {
  ingresoSchema,
  movimientosQuerySchema,
} from "@/lib/validations/modulo4";
import { obtenerTarifaVigente } from "@/lib/tarifas";
import { calcularMontoEstadia } from "@/lib/calculo-estadia";

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
          // Igual que en PHP: si no hay tarifa vigente, el monto es 0.
          const centavos = tarifa?.tarifa_hora_centavos ?? 0;
          const calc = calcularMontoEstadia(row.hora_entrada, ahora, centavos);
          return {
            ...row,
            tiempo_transcurrido_minutos: calc.minutosTotales,
            horas_estimadas: calc.horasCobrables,
            monto_estimado: calc.montoTotalPesos,
            // Nominal exacto como texto, sin pasar por punto flotante.
            tarifa_hora_aplicada: tarifa?.tarifa_hora ?? "0.00",
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

    // Toda la regla de negocio (lock FOR UPDATE de la plaza, lock de patente,
    // alta de vehículo si no existe, movimiento, estado de plaza y auditoría)
    // corre dentro de UNA única transacción en registrarIngreso.
    const resultado = await registrarIngreso(getPool(), data, {
      usuarioId: user.id,
      ip: clientIp(request),
    });

    return Response.json(resultado.movimiento, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
