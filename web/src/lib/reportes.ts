/**
 * Reportes operativos de REFERENCIA INTERNA.
 *
 * Caja, deudas, ocupación. Cálculos en centavos exactos vía @/lib/dinero.
 * No generan archivos oficiales; son herramientas de apoyo.
 */
import type { Pool } from "pg";
import { centavosAPesosTexto, sumarCentavos } from "@/lib/dinero";

export type RangoFechas = { desde: string; hasta: string };

// ---------- CAJA ----------

export type FilaCajaDiaria = {
  fecha: string;
  total: string;
  efectivo: string;
  tarjeta: string;
  transferencia: string;
  otras: string;
  operaciones: number;
};

export type ReporteCaja = {
  periodo: RangoFechas;
  dias: FilaCajaDiaria[];
  totales: {
    operaciones: number;
    total: string;
    efectivo: string;
    tarjeta: string;
    transferencia: string;
    otras: string;
  };
};

export async function reporteCaja(
  pool: Pool,
  periodo: RangoFechas,
): Promise<ReporteCaja> {
  const sql = `
    SELECT
      DATE(m.hora_salida AT TIME ZONE 'America/Argentina/Buenos_Aires') AS fecha,
      COALESCE(SUM(m.monto_pagado), 0) AS total_centavos,
      COALESCE(SUM(CASE WHEN LOWER(m.forma_pago) LIKE '%efect%' THEN m.monto_pagado ELSE 0 END), 0) AS efectivo_centavos,
      COALESCE(SUM(CASE WHEN LOWER(m.forma_pago) LIKE '%tarj%' OR LOWER(m.forma_pago) LIKE '%debito%' OR LOWER(m.forma_pago) LIKE '%credito%' THEN m.monto_pagado ELSE 0 END), 0) AS tarjeta_centavos,
      COALESCE(SUM(CASE WHEN LOWER(m.forma_pago) LIKE '%transf%' OR LOWER(m.forma_pago) LIKE '%mp%' OR LOWER(m.forma_pago) LIKE '%mercado%' THEN m.monto_pagado ELSE 0 END), 0) AS transferencia_centavos,
      COALESCE(SUM(CASE
        WHEN LOWER(m.forma_pago) NOT LIKE '%efect%'
         AND LOWER(m.forma_pago) NOT LIKE '%tarj%'
         AND LOWER(m.forma_pago) NOT LIKE '%debito%'
         AND LOWER(m.forma_pago) NOT LIKE '%credito%'
         AND LOWER(m.forma_pago) NOT LIKE '%transf%'
         AND LOWER(m.forma_pago) NOT LIKE '%mp%'
         AND LOWER(m.forma_pago) NOT LIKE '%mercado%'
         AND m.forma_pago IS NOT NULL
        THEN m.monto_pagado ELSE 0 END), 0) AS otras_centavos,
      COUNT(*)::int AS operaciones
    FROM movimientos m
    WHERE m.estado_pago = 'pagado'
      AND m.hora_salida IS NOT NULL
      AND DATE(m.hora_salida AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2
    GROUP BY DATE(m.hora_salida AT TIME ZONE 'America/Argentina/Buenos_Aires')
    ORDER BY fecha DESC
  `;

  const { rows } = await pool.query(sql, [periodo.desde, periodo.hasta]);

  const dias: FilaCajaDiaria[] = rows.map((r) => ({
    fecha: r.fecha,
    total: centavosAPesosTexto(Number(r.total_centavos)),
    efectivo: centavosAPesosTexto(Number(r.efectivo_centavos)),
    tarjeta: centavosAPesosTexto(Number(r.tarjeta_centavos)),
    transferencia: centavosAPesosTexto(Number(r.transferencia_centavos)),
    otras: centavosAPesosTexto(Number(r.otras_centavos)),
    operaciones: Number(r.operaciones),
  }));

  const totales = dias.reduce(
    (acc, d) => ({
      operaciones: acc.operaciones + d.operaciones,
      total: sumarCentavos(acc.total, d.total),
      efectivo: sumarCentavos(acc.efectivo, d.efectivo),
      tarjeta: sumarCentavos(acc.tarjeta, d.tarjeta),
      transferencia: sumarCentavos(acc.transferencia, d.transferencia),
      otras: sumarCentavos(acc.otras, d.otras),
    }),
    {
      operaciones: 0,
      total: "0.00",
      efectivo: "0.00",
      tarjeta: "0.00",
      transferencia: "0.00",
      otras: "0.00",
    },
  );

  return { periodo, dias, totales };
}

// ---------- DEUDAS ----------

export type FilaDeudaOperativa = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  cliente_documento: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  tipo: "movimiento" | "alquiler";
  referencia: string;
  monto_original: string;
  monto_con_interes: string;
  fecha_vencimiento: string;
  dias_atraso: number;
  estado: "pendiente" | "pagada" | "parcial";
};

export type ReporteDeudas = {
  periodo: RangoFechas;
  filas: FilaDeudaOperativa[];
  totales: {
    cantidad: number;
    monto_original: string;
    monto_con_interes: string;
    vencidas: number;
  };
};

export async function reporteDeudas(
  pool: Pool,
  _periodo: RangoFechas,
): Promise<ReporteDeudas> {
  const movSql = `
    SELECT
      d.id,
      d.cliente_id,
      c.nombre AS cliente_nombre,
      c.documento AS cliente_documento,
      c.email AS cliente_email,
      c.telefono AS cliente_telefono,
      'movimiento' AS tipo,
      m.patente AS referencia,
      d.monto_original,
      d.monto_con_interes,
      d.fecha_vencimiento,
      d.estado,
      GREATEST(0, (CURRENT_DATE - DATE(d.fecha_vencimiento))::int) AS dias_atraso
    FROM deudas d
    JOIN clientes c ON d.cliente_id = c.id
    LEFT JOIN movimientos m ON d.movimiento_id = m.id
    WHERE d.estado = 'pendiente'
  `;

  const alqSql = `
    SELECT
      ca.id AS contrato_id,
      c.id AS cliente_id,
      c.nombre AS cliente_nombre,
      c.documento AS cliente_documento,
      c.email AS cliente_email,
      c.telefono AS cliente_telefono,
      'alquiler' AS tipo,
      p.numero AS referencia,
      (ca.cuota_mensual * ca.cantidad_cuotas)::text AS monto_original,
      (ca.cuota_mensual * ca.cantidad_cuotas)::text AS monto_con_interes,
      (ca.fecha_inicio + (ca.cuotas_pagadas || 0) * interval '1 month')::date AS fecha_vencimiento,
      'pendiente' AS estado,
      GREATEST(0, (CURRENT_DATE - (ca.fecha_inicio + (ca.cuotas_pagadas || 0) * interval '1 month')::date)::int) AS dias_atraso
    FROM contratos_alquiler ca
    JOIN clientes c ON ca.cliente_id = c.id
    JOIN plazas p ON ca.plaza_id = p.id
    WHERE ca.estado = 'activo'
      AND (ca.cuotas_pagadas || 0) < ca.cantidad_cuotas
  `;

  const [movRes, alqRes] = await Promise.all([
    pool.query(movSql),
    pool.query(alqSql),
  ]);

  const filas: FilaDeudaOperativa[] = [
    ...movRes.rows.map((r) => ({
      id: Number(r.id),
      cliente_id: Number(r.cliente_id),
      cliente_nombre: r.cliente_nombre,
      cliente_documento: r.cliente_documento,
      cliente_email: r.cliente_email,
      cliente_telefono: r.cliente_telefono,
      tipo: "movimiento" as const,
      referencia: r.referencia ?? "—",
      monto_original: r.monto_original,
      monto_con_interes: r.monto_con_interes,
      fecha_vencimiento: r.fecha_vencimiento,
      dias_atraso: Number(r.dias_atraso),
      estado: r.estado as "pendiente" | "pagada" | "parcial",
    })),
    ...alqRes.rows.map((r) => ({
      id: Number(r.contrato_id),
      cliente_id: Number(r.cliente_id),
      cliente_nombre: r.cliente_nombre,
      cliente_documento: r.cliente_documento,
      cliente_email: r.cliente_email,
      cliente_telefono: r.cliente_telefono,
      tipo: "alquiler" as const,
      referencia: `Plaza ${r.referencia}`,
      monto_original: r.monto_original,
      monto_con_interes: r.monto_con_interes,
      fecha_vencimiento: r.fecha_vencimiento,
      dias_atraso: Number(r.dias_atraso),
      estado: "pendiente" as const,
    })),
  ].sort((a, b) => a.dias_atraso - b.dias_atraso);

  const totales = filas.reduce(
    (acc, f) => ({
      cantidad: acc.cantidad + 1,
      monto_original: sumarCentavos(acc.monto_original, f.monto_original),
      monto_con_interes: sumarCentavos(acc.monto_con_interes, f.monto_con_interes),
      vencidas: acc.vencidas + (f.dias_atraso > 0 ? 1 : 0),
    }),
    { cantidad: 0, monto_original: "0.00", monto_con_interes: "0.00", vencidas: 0 },
  );

  return { periodo: _periodo, filas, totales };
}

// ---------- OCUPACIÓN ----------

export type FilaOcupacionSector = {
  sector: string;
  total: number;
  ocupadas: number;
  libres: number;
  porcentaje: string;
};

export type FilaContratoActivo = {
  plaza_numero: string;
  sector: string;
  cliente_nombre: string;
  fecha_fin: string | null;
};

export type ReporteOcupacion = {
  fecha: string;
  resumen: {
    total_plazas: number;
    ocupadas_rotacion: number;
    ocupadas_alquiler: number;
    libres: number;
    porcentaje_ocupacion: string;
  };
  por_sector: FilaOcupacionSector[];
  contratos_activos: FilaContratoActivo[];
};

export async function reporteOcupacion(pool: Pool): Promise<ReporteOcupacion> {
  const hoy = new Date().toISOString().split("T")[0];

  const rotSql = `
    SELECT p.sector, COUNT(*)::int AS ocupadas
    FROM movimientos m
    JOIN plazas p ON m.plaza_id = p.id
    WHERE m.hora_salida IS NULL
      AND m.eliminado_en IS NULL
      AND p.eliminado_en IS NULL
    GROUP BY p.sector
  `;

  const alqSql = `
    SELECT p.sector, COUNT(*)::int AS ocupadas
    FROM contratos_alquiler ca
    JOIN plazas p ON ca.plaza_id = p.id
    WHERE ca.estado = 'activo'
      AND ca.fecha_inicio <= $1
      AND (ca.fecha_fin IS NULL OR ca.fecha_fin > $1)
      AND p.eliminado_en IS NULL
    GROUP BY p.sector
  `;

  const totSql = `
    SELECT sector, COUNT(*)::int AS total
    FROM plazas
    WHERE eliminado_en IS NULL
    GROUP BY sector
  `;

  const detSql = `
    SELECT p.numero AS plaza_numero, p.sector, c.nombre AS cliente_nombre, ca.fecha_fin
    FROM contratos_alquiler ca
    JOIN plazas p ON ca.plaza_id = p.id
    JOIN clientes c ON ca.cliente_id = c.id
    WHERE ca.estado = 'activo'
      AND ca.fecha_inicio <= $1
      AND (ca.fecha_fin IS NULL OR ca.fecha_fin > $1)
      AND p.eliminado_en IS NULL
    ORDER BY p.sector, p.numero
  `;

  const [rotRes, alqRes, totRes, detRes] = await Promise.all([
    pool.query(rotSql),
    pool.query(alqSql, [hoy]),
    pool.query(totSql),
    pool.query(detSql, [hoy]),
  ]);

  const rotMap = new Map(rotRes.rows.map((r) => [r.sector, Number(r.ocupadas)]));
  const alqMap = new Map(alqRes.rows.map((r) => [r.sector, Number(r.ocupadas)]));

  const por_sector: FilaOcupacionSector[] = totRes.rows
    .map((r) => {
      const sector = r.sector;
      const total = Number(r.total);
      const ocupadas_rot = rotMap.get(sector) ?? 0;
      const ocupadas_alq = alqMap.get(sector) ?? 0;
      const ocupadas = ocupadas_rot + ocupadas_alq;
      const libres = total - ocupadas;
      return {
        sector,
        total,
        ocupadas,
        libres,
        porcentaje: total > 0 ? ((ocupadas / total) * 100).toFixed(1) : "0.0",
      };
    })
    .sort((a, b) => a.sector.localeCompare(b.sector));

  const total_plazas = por_sector.reduce((s, r) => s + r.total, 0);
  const ocupadas_rotacion = por_sector.reduce((s, r) => s + (rotMap.get(r.sector) ?? 0), 0);
  const ocupadas_alquiler = por_sector.reduce((s, r) => s + (alqMap.get(r.sector) ?? 0), 0);
  const ocupadas_total = ocupadas_rotacion + ocupadas_alquiler;
  const libres = total_plazas - ocupadas_total;

  return {
    fecha: hoy,
    resumen: {
      total_plazas,
      ocupadas_rotacion,
      ocupadas_alquiler,
      libres,
      porcentaje_ocupacion: total_plazas > 0 ? ((ocupadas_total / total_plazas) * 100).toFixed(1) : "0.0",
    },
    por_sector,
    contratos_activos: detRes.rows.map((r) => ({
      plaza_numero: r.plaza_numero,
      sector: r.sector,
      cliente_nombre: r.cliente_nombre,
      fecha_fin: r.fecha_fin,
    })),
  };
}
