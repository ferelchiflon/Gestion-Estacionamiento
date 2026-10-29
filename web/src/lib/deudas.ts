import type { Pool, PoolClient } from "pg";
import { auditar } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { centavosAPesosTexto, pesosTextoACentavos } from "@/lib/dinero";
import type { DeudaActor } from "@/lib/validations/deudas";

export type DeudaMovimientoFila = {
  id: number;
  cliente_id: number;
  movimiento_id: number;
  monto_original: string;
  monto_con_interes: string;
  fecha_vencimiento: Date | string;
  estado: string;
  created_at: Date | string;
  cliente_nombre: string;
  cliente_documento: string | null;
  cliente_email: string | null;
  patente: string;
  hora_entrada: Date | string;
  hora_salida: Date | string | null;
  dias_antiguedad: number;
  tipo: "movimiento";
};

export type DeudaAlquilerFila = {
  contrato_id: number;
  cliente_id: number;
  cliente_nombre: string;
  cliente_email: string | null;
  cliente_telefono: string | null;
  plaza_numero: string;
  plaza_sector: string;
  cuota_mensual: string;
  dia_vencimiento: number;
  periodo: string;
  dias_retraso: number;
  tipo: "alquiler";
};

export type DeudaUnificada = DeudaMovimientoFila | DeudaAlquilerFila;

export type ResumenDeudas = {
  total_adeudado: string;
  deudas_criticas: number;
  clientes_con_deuda: number;
  total_movimientos: number;
  total_alquileres: number;
};

async function enTransaccion<T>(
  pool: Pool,
  operacion: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultado = await operacion(client);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function calcularDiasAntiguedad(fecha: Date | string): number {
  const hoy = new Date();
  const f = typeof fecha === "string" ? new Date(fecha) : fecha;
  const diffMs = hoy.getTime() - f.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Obtiene deudas de movimientos (estado 'deuda' en movimientos + tabla deudas)
 */
export async function getDeudasMovimientos(
  pool: Pool,
  filtros: {
    cliente_id?: number;
    estado?: "pendiente" | "pagada" | "todas";
    antiguedad_min?: number;
    antiguedad_max?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: DeudaMovimientoFila[]; total: number }> {
  const { cliente_id, estado = "pendiente", antiguedad_min, antiguedad_max, limit = 20, offset = 0 } = filtros;

  let whereClause = "WHERE d.eliminado_en IS NULL";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (cliente_id) {
    whereClause += ` AND d.cliente_id = $${paramIndex}`;
    params.push(cliente_id);
    paramIndex++;
  }

  if (estado !== "todas") {
    whereClause += ` AND d.estado = $${paramIndex}`;
    params.push(estado);
    paramIndex++;
  }

  if (antiguedad_min !== undefined) {
    whereClause += ` AND d.fecha_vencimiento <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - $${paramIndex}::int`;
    params.push(antiguedad_min);
    paramIndex++;
  }

  if (antiguedad_max !== undefined) {
    whereClause += ` AND d.fecha_vencimiento >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - $${paramIndex}::int`;
    params.push(antiguedad_max);
    paramIndex++;
  }

  const countSql = `
    SELECT count(*)::int as total
    FROM deudas d
    ${whereClause}
  `;
  const countRes = await pool.query(countSql, params);
  const total = countRes.rows[0]?.total ?? 0;

  const dataSql = `
    SELECT
      d.*,
      c.nombre as cliente_nombre,
      c.documento as cliente_documento,
      c.email as cliente_email,
      m.patente,
      m.hora_entrada,
      m.hora_salida,
      ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - d.fecha_vencimiento) as dias_antiguedad
    FROM deudas d
    JOIN clientes c ON d.cliente_id = c.id
    JOIN movimientos m ON d.movimiento_id = m.id
    ${whereClause}
    ORDER BY d.fecha_vencimiento ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const dataRes = await pool.query<DeudaMovimientoFila>(dataSql, params);

  const data = dataRes.rows.map((row) => ({
    ...row,
    dias_antiguedad: row.dias_antiguedad ?? calcularDiasAntiguedad(row.fecha_vencimiento),
    tipo: "movimiento" as const,
  }));

  return { data, total };
}

/**
 * Obtiene pagos pendientes de alquileres
 */
export async function getDeudasAlquileres(
  pool: Pool,
  filtros: {
    cliente_id?: number;
    estado?: "pendiente" | "pagada" | "todas";
    antiguedad_min?: number;
    antiguedad_max?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: DeudaAlquilerFila[]; total: number }> {
  const { cliente_id, antiguedad_min, limit = 20, offset = 0 } = filtros;

  let whereClause = "WHERE ca.estado = 'activo' AND ca.tipo_alquiler_id IN (2,3) AND ca.eliminado_en IS NULL";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (cliente_id) {
    whereClause += ` AND ca.cliente_id = $${paramIndex}`;
    params.push(cliente_id);
    paramIndex++;
  }

  if (antiguedad_min !== undefined) {
    whereClause += ` AND ca.dia_vencimiento <= EXTRACT(DAY FROM (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) - $${paramIndex}`;
    params.push(antiguedad_min);
    paramIndex++;
  }

  const countSql = `
    SELECT count(*)::int as total
    FROM contratos_alquiler ca
    JOIN clientes c ON ca.cliente_id = c.id
    JOIN plazas p ON ca.plaza_id = p.id
    ${whereClause}
    AND NOT EXISTS (
      SELECT 1 FROM pagos_alquiler pa
      WHERE pa.contrato_id = ca.id
        AND pa.periodo = to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM')
        AND pa.estado = 'pagado'
    )
  `;
  const countRes = await pool.query(countSql, params);
  const total = countRes.rows[0]?.total ?? 0;

  const dataSql = `
    SELECT
      ca.id as contrato_id,
      c.nombre as cliente_nombre,
      c.email as cliente_email,
      c.telefono as cliente_telefono,
      p.numero as plaza_numero,
      p.sector as plaza_sector,
      ca.cuota_mensual::text as cuota_mensual,
      ca.dia_vencimiento,
      to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM') as periodo,
      GREATEST(0, EXTRACT(DAY FROM (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) - ca.dia_vencimiento)::int as dias_retraso
    FROM contratos_alquiler ca
    JOIN clientes c ON ca.cliente_id = c.id
    JOIN plazas p ON ca.plaza_id = p.id
    ${whereClause}
    AND NOT EXISTS (
      SELECT 1 FROM pagos_alquiler pa
      WHERE pa.contrato_id = ca.id
        AND pa.periodo = to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM')
        AND pa.estado = 'pagado'
    )
    ORDER BY ca.dia_vencimiento ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const dataRes = await pool.query<DeudaAlquilerFila>(dataSql, params);

  const data = dataRes.rows.map((row) => ({
    ...row,
    tipo: "alquiler" as const,
  }));

  return { data, total };
}

/**
 * Obtiene todas las deudas unificadas (movimientos + alquileres)
 */
export async function getDeudasUnificadas(
  pool: Pool,
  filtros: {
    cliente_id?: number;
    tipo?: "movimiento" | "alquiler" | "todas";
    estado?: "pendiente" | "pagada" | "todas";
    antiguedad_min?: number;
    antiguedad_max?: number;
    sort_by?: "monto" | "antiguedad" | "cliente";
    sort_order?: "asc" | "desc";
    page?: number;
    limit?: number;
  } = {}
): Promise<{ data: DeudaUnificada[]; total: number; resumen: ResumenDeudas }> {
  const { tipo = "todas", page = 1, limit = 20 } = filtros;
  const offset = (page - 1) * limit;

  let movimientosData: DeudaMovimientoFila[] = [];
  let alquileresData: DeudaAlquilerFila[] = [];
  let totalMovimientos = 0;
  let totalAlquileres = 0;

  if (tipo === "todas" || tipo === "movimiento") {
    const res = await getDeudasMovimientos(pool, {
      ...filtros,
      limit: tipo === "todas" ? Math.ceil(limit / 2) : limit,
      offset: tipo === "todas" ? Math.ceil(offset / 2) : offset,
    });
    movimientosData = res.data;
    totalMovimientos = res.total;
  }

  if (tipo === "todas" || tipo === "alquiler") {
    const res = await getDeudasAlquileres(pool, {
      ...filtros,
      limit: tipo === "todas" ? Math.ceil(limit / 2) : limit,
      offset: tipo === "todas" ? Math.ceil(offset / 2) : offset,
    });
    alquileresData = res.data;
    totalAlquileres = res.total;
  }

  const allDeudas = [
    ...movimientosData.map((d) => ({ ...d, monto_orden: parseFloat(d.monto_con_interes), antiguedad_orden: d.dias_antiguedad })),
    ...alquileresData.map((d) => ({ ...d, monto_orden: parseFloat(d.cuota_mensual), antiguedad_orden: d.dias_retraso })),
  ];

  const sortBy = filtros.sort_by ?? "antiguedad";
  const sortOrder = filtros.sort_order ?? "desc";

  allDeudas.sort((a, b) => {
    let valA: number;
    let valB: number;

    if (sortBy === "monto") {
      valA = "monto_orden" in a ? a.monto_orden : 0;
      valB = "monto_orden" in b ? b.monto_orden : 0;
    } else if (sortBy === "cliente") {
      const nombreA = a.cliente_nombre || "";
      const nombreB = b.cliente_nombre || "";
      return sortOrder === "asc" ? nombreA.localeCompare(nombreB) : nombreB.localeCompare(nombreA);
    } else {
      valA = "antiguedad_orden" in a ? a.antiguedad_orden : 0;
      valB = "antiguedad_orden" in b ? b.antiguedad_orden : 0;
    }

    return sortOrder === "asc" ? valA - valB : valB - valA;
  });

  const paginated = allDeudas.slice(0, limit);

  const totalAdeudadoCentavos = allDeudas.reduce((sum, d) => {
    const monto = "monto_con_interes" in d ? parseFloat(d.monto_con_interes) : parseFloat(d.cuota_mensual);
    return sum + Math.round(monto * 100);
  }, 0);

  const deudasCriticas = allDeudas.filter((d) => {
    const dias = "dias_antiguedad" in d ? d.dias_antiguedad : d.dias_retraso;
    return dias > 30;
  }).length;

  const clientesUnicos = new Set(allDeudas.map((d) => d.cliente_id)).size;

  const resumen = {
    total_adeudado: centavosAPesosTexto(totalAdeudadoCentavos),
    deudas_criticas: deudasCriticas,
    clientes_con_deuda: clientesUnicos,
    total_movimientos: totalMovimientos,
    total_alquileres: totalAlquileres,
  };

  return {
    data: paginated.map((d) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { monto_orden, antiguedad_orden, ...rest } = d;
      return rest;
    }),
    total: allDeudas.length,
    resumen,
  };
}

/**
 * Marca una deuda de movimiento como saldada
 */
export async function marcarDeudaSaldada(
  pool: Pool,
  deudaId: number,
  actor: DeudaActor,
  observacion?: string
): Promise<void> {
  await enTransaccion(pool, async (client) => {
    const deudaRes = await client.query(
      `SELECT * FROM deudas WHERE id = $1 AND eliminado_en IS NULL`,
      [deudaId]
    );

    if (deudaRes.rowCount === 0) {
      throw new ApiError(404, "DEUDA_NO_ENCONTRADA", "La deuda no existe");
    }

    const deuda = deudaRes.rows[0];

    await client.query(
      `UPDATE deudas SET estado = 'pagada', eliminado_en = now() WHERE id = $1`,
      [deudaId]
    );

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      tabla: "deudas",
      registroId: deudaId,
      antes: { estado: deuda.estado },
      despues: { estado: "pagada", observacion: observacion ?? null },
      ip: actor.ip,
    });
  });
}

/**
 * Registra un pago parcial de una deuda de movimiento
 */
export async function registrarPagoParcialDeuda(
  pool: Pool,
  deudaId: number,
  datos: {
    monto: string;
    forma_pago: string;
    observacion?: string;
  },
  actor: DeudaActor
): Promise<void> {
  await enTransaccion(pool, async (client) => {
    const deudaRes = await client.query(
      `SELECT * FROM deudas WHERE id = $1 AND eliminado_en IS NULL`,
      [deudaId]
    );

    if (deudaRes.rowCount === 0) {
      throw new ApiError(404, "DEUDA_NO_ENCONTRADA", "La deuda no existe");
    }

    const deuda = deudaRes.rows[0];
    const montoPagoCentavos = pesosTextoACentavos(datos.monto);
    const montoActualCentavos = pesosTextoACentavos(deuda.monto_con_interes);

    if (montoPagoCentavos > montoActualCentavos) {
      throw new ApiError(422, "MONTO_EXCESIVO", "El monto del pago excede la deuda pendiente");
    }

    const nuevoMontoCentavos = montoActualCentavos - montoPagoCentavos;
    const nuevoMonto = centavosAPesosTexto(nuevoMontoCentavos);
    const nuevoEstado = nuevoMontoCentavos <= 0 ? "pagada" : "pendiente";

    const montoOriginalCentavos = pesosTextoACentavos(deuda.monto_original);
    const nuevoMontoOriginalCentavos = Math.max(0, montoOriginalCentavos - montoPagoCentavos);
    const nuevoMontoOriginal = centavosAPesosTexto(nuevoMontoOriginalCentavos);

    await client.query(
      `UPDATE deudas SET monto_con_interes = $1::numeric, monto_original = $2::numeric, estado = $3 WHERE id = $4`,
      [nuevoMonto, nuevoMontoOriginal, nuevoEstado, deudaId]
    );

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      tabla: "deudas",
      registroId: deudaId,
      antes: { monto_con_interes: deuda.monto_con_interes, monto_original: deuda.monto_original, estado: deuda.estado },
      despues: { monto_con_interes: nuevoMonto, monto_original: nuevoMontoOriginal, estado: nuevoEstado, observacion: datos.observacion ?? null },
      ip: actor.ip,
    });

    if (nuevoEstado === "pagada" && deuda.movimiento_id) {
      await client.query(
        `UPDATE movimientos SET estado_pago = 'pagado', monto_pagado = monto_calculado WHERE id = $1`,
        [deuda.movimiento_id]
      );
    }
  });
}
