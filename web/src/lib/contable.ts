import type { Pool, PoolClient } from "pg";
import { centavosAPesosTexto, pesosTextoACentavos } from "@/lib/dinero";

/**
 * Módulo contable de REFERENCIA INTERNA.
 *
 * Estos reportes son herramientas de apoyo para el contador: NO son
 * declaraciones juradas, NO generan archivos oficiales (ARCA/AFIP) y NO
 * incluyen IIBB. Todo el cálculo monetario se hace en centavos enteros
 * (`@/lib/dinero`); nunca se usan floats para sumar importes.
 *
 * Limitación estructural known: el sistema NO discrimina la alícuota de IVA
 * por operación de venta. Por eso las ventas usan la alícuota general de
 * `configuracion_fiscal` y el reporte lo declara en sus advertencias.
 */

export const ALICUOTAS_IVA = [21, 10.5, 27] as const;
export type AlicuotaIva = (typeof ALICUOTAS_IVA)[number];

export type RangoContable = {
  desde: string;
  hasta: string;
};

export type OperacionVenta = {
  recibo_id: number;
  recibo_numero: number;
  fecha: string;
  tipo: "movimiento" | "alquiler";
  detalle: string;
  cliente: string | null;
  forma_pago: string | null;
  monto_total: string;
  neto: string;
  iva: string;
  alicuota: string;
};

export type TotalesVentasAlicuota = {
  alicuota: string;
  operaciones: number;
  neto: string;
  iva: string;
  total: string;
};

export type ReporteIvaVentas = {
  periodo: RangoContable;
  alicuota_general: string;
  discrimina_alicuota_por_operacion: boolean;
  condicion_iva: string;
  operaciones: OperacionVenta[];
  totales_por_alicuota: TotalesVentasAlicuota[];
  totales: {
    operaciones: number;
    neto: string;
    iva: string;
    total: string;
  };
  advertencias: string[];
};

export type ComprobanteCompra = {
  id: number;
  fecha: string;
  proveedor: string;
  cuit_proveedor: string | null;
  tipo_comprobante: string;
  punto_venta: number | null;
  numero_comprobante: number | null;
  neto_gravado: string;
  iva_21: string;
  iva_105: string;
  iva_27: string;
  no_gravado: string;
  percepcion_iva: string;
  percepcion_iibb: string;
  total: string;
  categoria: string | null;
  forma_pago: string | null;
};

export type TotalesComprasAlicuota = {
  alicuota: string;
  comprobantes: number;
  iva: string;
};

export type ReporteIvaCompras = {
  periodo: RangoContable;
  comprobantes: ComprobanteCompra[];
  totales_por_alicuota: TotalesComprasAlicuota[];
  totales: {
    comprobantes: number;
    neto_gravado: string;
    iva: string;
    no_gravado: string;
    percepcion_iva: string;
    percepcion_iibb: string;
    total: string;
  };
  advertencias: string[];
};

export type FilaPosicionIva = {
  alicuota: string;
  iva_ventas: string;
  iva_compras: string;
  saldo: string;
  estado: "a_pagar" | "a_favor" | "en_equilibrio";
};

export type ReportePosicionIva = {
  periodo: RangoContable;
  filas: FilaPosicionIva[];
  percepciones_iva: string;
  saldo_total: string;
  estado_total: "a_pagar" | "a_favor" | "en_equilibrio";
  totales_ventas: {
    operaciones: number;
    neto: string;
    iva: string;
    total: string;
  };
  totales_compras: {
    comprobantes: number;
    neto_gravado: string;
    iva: string;
    total: string;
  };
  advertencias: string[];
};

/** Transacción de solo lectura: el reporte no puede escribir nada. */
async function enLectura<T>(
  pool: Pool,
  operacion: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
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

/** Convierte una alícuota en puntos básicos (21,00% -> 2100). */
function alicuotaAPuntosBasicos(alicuota: number): number {
  return Math.round(alicuota * 100);
}

/**
 * Descompone un importe con IVA incluido en neto + IVA, en centavos.
 * El IVA se calcula como la diferencia para que neto + IVA cuadre exacto.
 */
function desglosarIvaInclusive(
  totalCentavos: number,
  alicuota: number,
): { netoCentavos: number; ivaCentavos: number } {
  const puntos = alicuotaAPuntosBasicos(alicuota);
  const netoCentavos = Math.round((totalCentavos * 10000) / (10000 + puntos));
  return {
    netoCentavos,
    ivaCentavos: totalCentavos - netoCentavos,
  };
}

/** Formatea una alícuota como texto con 2 decimales ("21.00"). */
function formatearAlicuota(alicuota: number): string {
  return alicuota.toFixed(2);
}

function estadoSaldo(saldoCentavos: number): "a_pagar" | "a_favor" | "en_equilibrio" {
  if (saldoCentavos > 0) return "a_pagar";
  if (saldoCentavos < 0) return "a_favor";
  return "en_equilibrio";
}

/** Rango de timestamps en zona Argentina, para filtrar por período. */
function rangoTimestamps(desde: string, hasta: string): [string, string] {
  // `desde`/`hasta` llegan validados por Zod (^\d{4}-\d{2}-\d{2}$), es seguro
  // incluirlos como literales entre comillas simples.
  const inicio = `'${desde}'::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'`;
  const fin = `('${hasta}'::date + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'`;
  return [inicio, fin];
}

type VentaRow = {
  recibo_id: number;
  recibo_numero: number;
  fecha: string;
  monto: string;
  forma_pago: string | null;
  movimiento_id: number | null;
  contrato_id: number | null;
  cliente_nombre: string | null;
  patente: string | null;
  plaza_numero: string | null;
  plaza_sector: string | null;
  contrato_periodo: string | null;
};

const ADVERTENCIA_REFERENCIA =
  "Reporte de referencia interna, sujeto a revisión y aprobación del contador. " +
  "No constituye una declaración jurada.";

export { ADVERTENCIA_REFERENCIA };

/**
 * IVA de ventas: ingresos del período con neto e IVA por alícuota.
 *
 * Fuentes (solo lo que el sistema documenta con comprobante):
 *   - Recibos de movimientos de estacionamiento (se emiten al cobrar).
 *   - Recibos de pagos de alquiler, siempre que el pago esté vigente
 *     (`pagos_alquiler.estado = 'pagado'`). El vínculo pago -> recibo es
 *     obligatorio (migración 009), así que un pago anulado no se computa.
 *
 * El período se atribuye por la fecha de emisión del recibo.
 */
export async function ivaVentas(
  pool: Pool,
  periodo: RangoContable,
): Promise<ReporteIvaVentas> {
  const [desde, hasta] = rangoTimestamps(periodo.desde, periodo.hasta);

  return enLectura(pool, async (client) => {
    const fiscalRes = await client.query<{
      alicuota_iva: string;
      condicion_iva: string;
    }>(
      `SELECT COALESCE(alicuota_iva, 21)::text AS alicuota_iva,
              COALESCE(condicion_iva, 'responsable_inscripto') AS condicion_iva
         FROM configuracion_fiscal
        WHERE id = 1`,
    );

    const fiscal = fiscalRes.rows[0];
    const alicuotaGeneral = fiscal ? Number(fiscal.alicuota_iva) : 21;
    const condicionIva = fiscal?.condicion_iva ?? "responsable_inscripto";

    const operRes = await client.query<VentaRow>(
      `SELECT r.id AS recibo_id,
              r.numero AS recibo_numero,
              to_char(r.fecha_emision AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
              r.monto::text AS monto,
              r.forma_pago,
              r.movimiento_id,
              r.contrato_id,
              c.nombre AS cliente_nombre,
              m.patente,
              COALESCE(pl_mov.numero, pl_con.numero) AS plaza_numero,
              COALESCE(pl_mov.sector, pl_con.sector) AS plaza_sector,
              pa.periodo AS contrato_periodo
         FROM recibos r
         LEFT JOIN clientes c ON c.id = r.cliente_id
         LEFT JOIN movimientos m ON m.id = r.movimiento_id
         LEFT JOIN plazas pl_mov ON pl_mov.id = m.plaza_id
         LEFT JOIN contratos_alquiler ca ON ca.id = r.contrato_id
         LEFT JOIN plazas pl_con ON pl_con.id = ca.plaza_id
         LEFT JOIN pagos_alquiler pa
                ON pa.recibo_id = r.id
               AND pa.estado = 'pagado'
               AND pa.eliminado_en IS NULL
        WHERE r.eliminado_en IS NULL
          AND r.fecha_emision >= ${desde}
          AND r.fecha_emision < ${hasta}
          AND (
                (r.movimiento_id IS NOT NULL AND m.eliminado_en IS NULL)
             OR (r.contrato_id IS NOT NULL AND pa.id IS NOT NULL)
          )
        ORDER BY r.fecha_emision, r.numero`,
    );


    const operaciones: OperacionVenta[] = [];
    const porAlicuota = new Map<
      string,
      { alicuota: string; operaciones: number; neto: number; iva: number; total: number }
    >();

    for (const fila of operRes.rows) {
      const totalCentavos = pesosTextoACentavos(fila.monto);
      const { netoCentavos, ivaCentavos } = desglosarIvaInclusive(
        totalCentavos,
        alicuotaGeneral,
      );
      const alicuotaTexto = formatearAlicuota(alicuotaGeneral);

      const esMovimiento = fila.movimiento_id !== null;
      const plaza = fila.plaza_numero
        ? `Plaza ${fila.plaza_numero}${fila.plaza_sector ? ` (${fila.plaza_sector})` : ""}`
        : "Plaza sin dato";
      const detalle = esMovimiento
        ? `${fila.patente ? `Patente ${fila.patente} · ` : ""}${plaza}`
        : `${plaza}${fila.contrato_periodo ? ` · Período ${fila.contrato_periodo}` : ""}`;

      operaciones.push({
        recibo_id: fila.recibo_id,
        recibo_numero: fila.recibo_numero,
        fecha: fila.fecha,
        tipo: esMovimiento ? "movimiento" : "alquiler",
        detalle,
        cliente: fila.cliente_nombre,
        forma_pago: fila.forma_pago,
        monto_total: centavosAPesosTexto(totalCentavos),
        neto: centavosAPesosTexto(netoCentavos),
        iva: centavosAPesosTexto(ivaCentavos),
        alicuota: alicuotaTexto,
      });

      const acumulado = porAlicuota.get(alicuotaTexto) ?? {
        alicuota: alicuotaTexto,
        operaciones: 0,
        neto: 0,
        iva: 0,
        total: 0,
      };
      acumulado.operaciones += 1;
      acumulado.neto += netoCentavos;
      acumulado.iva += ivaCentavos;
      acumulado.total += totalCentavos;
      porAlicuota.set(alicuotaTexto, acumulado);
    }

    const totalesPorAlicuota: TotalesVentasAlicuota[] = [...porAlicuota.values()]
      .sort((a, b) => Number(b.alicuota) - Number(a.alicuota))
      .map((fila) => ({
        alicuota: fila.alicuota,
        operaciones: fila.operaciones,
        neto: centavosAPesosTexto(fila.neto),
        iva: centavosAPesosTexto(fila.iva),
        total: centavosAPesosTexto(fila.total),
      }));

    const totales = totalesPorAlicuota.reduce(
      (acc, fila) => ({
        operaciones: acc.operaciones + fila.operaciones,
        neto: acc.neto + pesosTextoACentavos(fila.neto),
        iva: acc.iva + pesosTextoACentavos(fila.iva),
        total: acc.total + pesosTextoACentavos(fila.total),
      }),
      { operaciones: 0, neto: 0, iva: 0, total: 0 },
    );

    const advertencias = [
      `El sistema no discrimina la alícuota de IVA por operación: se aplica la alícuota general de configuracion_fiscal (${formatearAlicuota(alicuotaGeneral)}%) a todos los ingresos del período.`,
      "Los ingresos se atribuyen por la fecha de emisión del recibo (America/Argentina/Buenos_Aires).",
      "No se incluyen deudas cobradas: la tabla deudas no registra fecha de pago, solo de creación.",
      ADVERTENCIA_REFERENCIA,
    ];

    if (condicionIva === "monotributo" || condicionIva === "exento") {
      advertencias.unshift(
        `La configuración fiscal declara condición IVA "${condicionIva}": este reporte de IVA no resulta aplicable.`,
      );
    }

    return {
      periodo,
      alicuota_general: formatearAlicuota(alicuotaGeneral),
      discrimina_alicuota_por_operacion: false,
      condicion_iva: condicionIva,
      operaciones,
      totales_por_alicuota: totalesPorAlicuota,
      totales: {
        operaciones: totales.operaciones,
        neto: centavosAPesosTexto(totales.neto),
        iva: centavosAPesosTexto(totales.iva),
        total: centavosAPesosTexto(totales.total),
      },
      advertencias,
    };
  });
}


type CompraRow = {
  id: number;
  fecha: string;
  proveedor: string;
  cuit_proveedor: string | null;
  tipo_comprobante: string;
  punto_venta: number | null;
  numero_comprobante: number | null;
  neto_gravado: string;
  iva_21: string;
  iva_105: string;
  iva_27: string;
  no_gravado: string;
  percepcion_iva: string;
  percepcion_iibb: string;
  total: string;
  categoria: string | null;
  forma_pago: string | null;
};

/**
 * IVA de compras: libro de compras del período con el IVA discriminado por
 * alícuota (21 / 10,5 / 27) que ya viene desglosado en `gastos_compras`.
 *
 * No se recalcula el IVA desde la base: se toma el importe cargado por el
 * usuario, que es el dato del comprobante. IIBB queda fuera de alcance.
 */
export async function ivaCompras(
  pool: Pool,
  periodo: RangoContable,
): Promise<ReporteIvaCompras> {
  return enLectura(pool, async (client) => {
    const res = await client.query<CompraRow>(
      `SELECT g.id,
              to_char(g.fecha, 'YYYY-MM-DD') AS fecha,
              g.proveedor,
              g.cuit_proveedor,
              g.tipo_comprobante,
              g.punto_venta,
              g.numero_comprobante,
              g.neto_gravado::text AS neto_gravado,
              g.iva_21::text AS iva_21,
              g.iva_105::text AS iva_105,
              g.iva_27::text AS iva_27,
              g.no_gravado::text AS no_gravado,
              g.percepcion_iva::text AS percepcion_iva,
              g.percepcion_iibb::text AS percepcion_iibb,
              g.total::text AS total,
              c.nombre AS categoria,
              g.forma_pago
         FROM gastos_compras g
         LEFT JOIN categorias_gasto c ON c.id = g.categoria_id
        WHERE g.eliminado_en IS NULL
          AND g.fecha >= $1::date
          AND g.fecha <= $2::date
        ORDER BY g.fecha, g.id`,
      [periodo.desde, periodo.hasta],
    );

    const comprobantes: ComprobanteCompra[] = res.rows.map((fila) => ({
      id: fila.id,
      fecha: fila.fecha,
      proveedor: fila.proveedor,
      cuit_proveedor: fila.cuit_proveedor,
      tipo_comprobante: fila.tipo_comprobante,
      punto_venta: fila.punto_venta,
      numero_comprobante: fila.numero_comprobante,
      neto_gravado: fila.neto_gravado,
      iva_21: fila.iva_21,
      iva_105: fila.iva_105,
      iva_27: fila.iva_27,
      no_gravado: fila.no_gravado,
      percepcion_iva: fila.percepcion_iva,
      percepcion_iibb: fila.percepcion_iibb,
      total: fila.total,
      categoria: fila.categoria,
      forma_pago: fila.forma_pago,
    }));

    const suma = (selector: (fila: CompraRow) => string): number =>
      res.rows.reduce((acc, fila) => acc + pesosTextoACentavos(selector(fila)), 0);

    const iva21 = suma((f) => f.iva_21);
    const iva105 = suma((f) => f.iva_105);
    const iva27 = suma((f) => f.iva_27);

    // Cada alícuota cuenta solo los comprobantes que efectivamente tienen IVA en ella.
    const conIva = (selector: (fila: CompraRow) => string): number =>
      res.rows.filter((fila) => pesosTextoACentavos(selector(fila)) > 0).length;

    const totalesPorAlicuota: TotalesComprasAlicuota[] = [
      {
        alicuota: "21.00",
        comprobantes: conIva((f) => f.iva_21),
        iva: centavosAPesosTexto(iva21),
      },
      {
        alicuota: "10.50",
        comprobantes: conIva((f) => f.iva_105),
        iva: centavosAPesosTexto(iva105),
      },
      {
        alicuota: "27.00",
        comprobantes: conIva((f) => f.iva_27),
        iva: centavosAPesosTexto(iva27),
      },
    ];

    const advertencias = [
      "El libro de compras discrimina el IVA por alícuota (21 / 10,5 / 27) pero no la base imponible: el neto por alícuota no está disponible.",
      "Las percepciones de IVA se informan por separado porque no están asociadas a una alícuota.",
      "IIBB: fuera del alcance de este reporte (se muestran solo a modo informativo).",
      ADVERTENCIA_REFERENCIA,
    ];

    return {
      periodo,
      comprobantes,
      totales_por_alicuota: totalesPorAlicuota,
      totales: {
        comprobantes: res.rowCount ?? 0,
        neto_gravado: centavosAPesosTexto(suma((f) => f.neto_gravado)),
        iva: centavosAPesosTexto(iva21 + iva105 + iva27),
        no_gravado: centavosAPesosTexto(suma((f) => f.no_gravado)),
        percepcion_iva: centavosAPesosTexto(suma((f) => f.percepcion_iva)),
        percepcion_iibb: centavosAPesosTexto(suma((f) => f.percepcion_iibb)),
        total: centavosAPesosTexto(suma((f) => f.total)),
      },
      advertencias,
    };
  });
}


/**
 * Posición de IVA del período: IVA de ventas menos IVA de compras por
 * alícuota. El saldo resultante es REFERENCIA para el contador: no implica
 * ningún pago, ninguna declaración ni obligación de pago por sí sola.
 */
export async function posicionIva(
  pool: Pool,
  periodo: RangoContable,
): Promise<ReportePosicionIva> {
  const [ventas, compras] = await Promise.all([
    ivaVentas(pool, periodo),
    ivaCompras(pool, periodo),
  ]);

  const ventasPorAlicuota = new Map<string, number>();
  for (const fila of ventas.totales_por_alicuota) {
    ventasPorAlicuota.set(fila.alicuota, pesosTextoACentavos(fila.iva));
  }
  const comprasPorAlicuota = new Map<string, number>();
  for (const fila of compras.totales_por_alicuota) {
    comprasPorAlicuota.set(fila.alicuota, pesosTextoACentavos(fila.iva));
  }

  const alicuotas = [...new Set([...ventasPorAlicuota.keys(), ...comprasPorAlicuota.keys()])]
    .sort((a, b) => Number(b) - Number(a));

  const filas: FilaPosicionIva[] = alicuotas.map((alicuota) => {
    const ivaVentasCentavos = ventasPorAlicuota.get(alicuota) ?? 0;
    const ivaComprasCentavos = comprasPorAlicuota.get(alicuota) ?? 0;
    const saldoCentavos = ivaVentasCentavos - ivaComprasCentavos;
    return {
      alicuota,
      iva_ventas: centavosAPesosTexto(ivaVentasCentavos),
      iva_compras: centavosAPesosTexto(ivaComprasCentavos),
      saldo: centavosAPesosTexto(saldoCentavos),
      estado: estadoSaldo(saldoCentavos),
    };
  });

  const percepcionesCentavos = pesosTextoACentavos(compras.totales.percepcion_iva);
  const saldoPorAlicuotas = filas.reduce(
    (acc, fila) => acc + pesosTextoACentavos(fila.saldo),
    0,
  );
  const saldoTotalCentavos = saldoPorAlicuotas - percepcionesCentavos;

  const advertencias = [
    "El saldo por alícuota se calcula como IVA de ventas menos IVA de compras del mismo período.",
    "Las percepciones de IVA no están asociadas a una alícuota: se descuentan del saldo total.",
    "El saldo es una referencia interna; no determina obligación de pago ni reemplaza la revisión del contador.",
    ...ventas.advertencias,
    ...compras.advertencias,
  ];

  return {
    periodo,
    filas,
    percepciones_iva: centavosAPesosTexto(percepcionesCentavos),
    saldo_total: centavosAPesosTexto(saldoTotalCentavos),
    estado_total: estadoSaldo(saldoTotalCentavos),
    totales_ventas: ventas.totales,
    totales_compras: {
      comprobantes: compras.totales.comprobantes,
      neto_gravado: compras.totales.neto_gravado,
      iva: compras.totales.iva,
      total: compras.totales.total,
    },
    advertencias: [...new Set(advertencias)],
  };
}
/**
 * IIBB: Ingresos Brutos del período (base = ventas netas del período).
 * Cálculo según alícuota de configuracion_fiscal y percepciones/retenciones cargadas.
 */
export async function iibb(
  pool: Pool,
  periodo: RangoContable,
): Promise<{
  periodo: RangoContable;
  alicuotaIva: string;
  alicuotaIibb: string;
  jurisdiccion: string;
  ventasBrutas: string;
  baseImponible: string;
  impuestoDeterminado: string;
  percepciones: string;
  retenciones: string;
  saldo: string;
  estado: "a_pagar" | "a_favor" | "en_equilibrio";
  porJurisdiccion: { jurisdiccion: string; percepciones: string; retenciones: string }[];
  advertencias: string[];
}> {
  return enLectura(pool, async (client) => {
    const cfg = await client.query(
      `SELECT alicuota_iva, alicuota_iibb, jurisdiccion_iibb
         FROM configuracion_fiscal WHERE id = 1`,
    );
    const alicuotaIva = Number(cfg.rows[0]?.alicuota_iva ?? 21);
    const alicuotaIibb = Number(cfg.rows[0]?.alicuota_iibb ?? 3);
    const jurisdiccion = cfg.rows[0]?.jurisdiccion_iibb ?? "CABA";

    const ventasRows = await client.query(
      `SELECT COALESCE(SUM(total_centavos), 0) AS total
         FROM (
           SELECT COALESCE(SUM(m.monto_pagado), 0) AS total_centavos
             FROM movimientos m
            WHERE m.estado_pago = 'pagado'
              AND m.hora_salida IS NOT NULL
              AND DATE(m.hora_salida AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2
           UNION ALL
           SELECT COALESCE(SUM(pa.monto), 0)
             FROM pagos_alquiler pa
            WHERE DATE(pa.fecha_pago) BETWEEN $1 AND $2
           UNION ALL
           SELECT COALESCE(SUM(d.monto_con_interes), 0)
             FROM deudas d
            WHERE d.estado = 'pagada'
              AND DATE(d.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2
         ) s`,
      [periodo.desde, periodo.hasta],
    );
    const ventasBrutasCentavos = Number(ventasRows.rows[0]?.total ?? 0);

    const baseImponibleCentavos = alicuotaIva > 0
      ? Math.round((ventasBrutasCentavos * 10000) / (10000 + alicuotaIva * 100))
      : ventasBrutasCentavos;

    const impuestoDeterminadoCentavos = Math.round(baseImponibleCentavos * alicuotaIibb / 100);

    const perRes = await client.query(
      `SELECT jurisdiccion,
              COALESCE(SUM(CASE WHEN tipo = 'percepcion' THEN monto END), 0) AS percepciones,
              COALESCE(SUM(CASE WHEN tipo = 'retencion' THEN monto END), 0) AS retenciones
         FROM percepciones_iibb
        WHERE periodo = to_char($1::date, 'YYYY-MM')
        GROUP BY jurisdiccion
        ORDER BY jurisdiccion`,
      [periodo.desde],
    );

    let totalPercepcionesCentavos = 0;
    let totalRetencionesCentavos = 0;
    const porJurisdiccion = perRes.rows.map((r) => {
      const perc = Number(r.percepciones);
      const ret = Number(r.retenciones);
      totalPercepcionesCentavos += perc;
      totalRetencionesCentavos += ret;
      return {
        jurisdiccion: r.jurisdiccion,
        percepciones: centavosAPesosTexto(perc),
        retenciones: centavosAPesosTexto(ret),
      };
    });

    const saldoCentavos = impuestoDeterminadoCentavos - totalPercepcionesCentavos - totalRetencionesCentavos;

    return {
      periodo,
      alicuotaIva: alicuotaIva.toFixed(2),
      alicuotaIibb: alicuotaIibb.toFixed(2),
      jurisdiccion,
      ventasBrutas: centavosAPesosTexto(ventasBrutasCentavos),
      baseImponible: centavosAPesosTexto(baseImponibleCentavos),
      impuestoDeterminado: centavosAPesosTexto(impuestoDeterminadoCentavos),
      percepciones: centavosAPesosTexto(totalPercepcionesCentavos),
      retenciones: centavosAPesosTexto(totalRetencionesCentavos),
      saldo: centavosAPesosTexto(saldoCentavos),
      estado: estadoSaldo(saldoCentavos),
      porJurisdiccion,
      advertencias: [
        "La base imponible se calcula como ventas netas (sin IVA) del período.",
        "Estructura preparada para Convenio Multilateral; hoy funciona con una sola jurisdicción.",
        ADVERTENCIA_REFERENCIA,
      ],
    };
  });
}

/**
 * Balance del período: ingresos por rubro menos gastos por categoría + cuentas por cobrar.
 */
export async function balance(
  pool: Pool,
  periodo: RangoContable,
): Promise<{
  periodo: RangoContable;
  ingresos: {
    estacionamiento: { ops: number; total: string };
    alquileres: { ops: number; total: string };
    deudas: { ops: number; total: string };
    total: string;
  };
  gastos: {
    porCategoria: { categoria: string; comprobantes: number; total: string }[];
    total: string;
  };
  cuentasPorCobrar: {
    cantidad: number;
    total: string;
    vencidas: number;
  };
  resultado: string;
  advertencias: string[];
}> {
  return enLectura(pool, async (client) => {
    const [est, alq, deu, gas, cxc] = await Promise.all([
      client.query(
        `SELECT COUNT(*)::int AS ops, COALESCE(SUM(monto_pagado), 0) AS total
           FROM movimientos
          WHERE estado_pago = 'pagado'
            AND DATE(hora_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2`,
        [periodo.desde, periodo.hasta],
      ),
      client.query(
        `SELECT COUNT(*)::int AS ops, COALESCE(SUM(monto), 0) AS total
           FROM pagos_alquiler
          WHERE DATE(fecha_pago) BETWEEN $1 AND $2`,
        [periodo.desde, periodo.hasta],
      ),
      client.query(
        `SELECT COUNT(*)::int AS ops, COALESCE(SUM(monto_con_interes), 0) AS total
           FROM deudas
          WHERE estado = 'pagada'
            AND DATE(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2`,
        [periodo.desde, periodo.hasta],
      ),
      client.query(
        `SELECT COALESCE(c.nombre, 'Sin categoría') AS categoria,
                COUNT(*)::int AS comprobantes,
                COALESCE(SUM(g.total), 0) AS total
           FROM gastos_compras g
           LEFT JOIN categorias_gasto c ON g.categoria_id = c.id
          WHERE g.fecha BETWEEN $1 AND $2
            AND g.eliminado_en IS NULL
          GROUP BY categoria
          ORDER BY total DESC`,
        [periodo.desde, periodo.hasta],
      ),
      client.query(
        `SELECT COUNT(*)::int AS cantidad,
                COALESCE(SUM(monto_con_interes), 0) AS total,
                COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN 1 ELSE 0 END), 0) AS vencidas
           FROM deudas
          WHERE estado = 'pendiente'`,
      ),
    ]);

    const ingresosTotalCentavos =
      Number(est.rows[0]?.total ?? 0) +
      Number(alq.rows[0]?.total ?? 0) +
      Number(deu.rows[0]?.total ?? 0);
    const gastosTotalCentavos = gas.rows.reduce((s, r) => s + Number(r.total), 0);
    const cxcTotalCentavos = Number(cxc.rows[0]?.total ?? 0);

    return {
      periodo,
      ingresos: {
        estacionamiento: { ops: Number(est.rows[0]?.ops ?? 0), total: centavosAPesosTexto(Number(est.rows[0]?.total ?? 0)) },
        alquileres: { ops: Number(alq.rows[0]?.ops ?? 0), total: centavosAPesosTexto(Number(alq.rows[0]?.total ?? 0)) },
        deudas: { ops: Number(deu.rows[0]?.ops ?? 0), total: centavosAPesosTexto(Number(deu.rows[0]?.total ?? 0)) },
        total: centavosAPesosTexto(ingresosTotalCentavos),
      },
      gastos: {
        porCategoria: gas.rows.map((r) => ({
          categoria: r.categoria,
          comprobantes: Number(r.comprobantes),
          total: centavosAPesosTexto(Number(r.total)),
        })),
        total: centavosAPesosTexto(gastosTotalCentavos),
      },
      cuentasPorCobrar: {
        cantidad: Number(cxc.rows[0]?.cantidad ?? 0),
        total: centavosAPesosTexto(cxcTotalCentavos),
        vencidas: Number(cxc.rows[0]?.vencidas ?? 0),
      },
      resultado: centavosAPesosTexto(ingresosTotalCentavos - gastosTotalCentavos),
      advertencias: [
        "Ingresos: fecha de emisión del recibo (Argentina). Deudas: fecha de creación (no de pago).",
        "El resultado no descuenta impuestos ni provisiones: es un indicador de gestión.",
        ADVERTENCIA_REFERENCIA,
      ],
    };
  });
}
/**
 * Reporte mensual comparativo: ingresos vs gastos, plazas, ocupación, deudas.
 */
export async function reporteMensual(
  pool: Pool,
  mes: number,
  anio: number,
): Promise<{
  periodo: { mes: number; anio: number; desde: string; hasta: string };
  ingresos: {
    estacionamiento: string;
    alquileres: string;
    deudas: string;
    total: string;
  };
  gastos: { total: string; porCategoria: { categoria: string; total: string }[] };
  plazas: { total: number; ocupadasRotacion: number; ocupadasAlquiler: number; libres: number; ocupacionPct: string };
  deudas: { pendientes: number; total: string; vencidas: number };
  advertencias: string[];
}> {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const hasta = new Date(anio, mes, 0).toISOString().split("T")[0];
  const rango = { desde, hasta };

  const [ing, _gas, deu] = await Promise.all([
    balance(pool, rango),
    ivaCompras(pool, rango),
    pool.query(
      `SELECT COUNT(*)::int AS cantidad,
              COALESCE(SUM(monto_con_interes), 0) AS total,
              COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN 1 ELSE 0 END), 0) AS vencidas
         FROM deudas
        WHERE estado = 'pendiente'`,
    ),
  ]);

  // Occupancy data - simplified for now, full data in /reportes
  const occRes = await pool.query(
    `SELECT 
       (SELECT COUNT(*) FROM plazas WHERE eliminado_en IS NULL) AS total_plazas,
       (SELECT COUNT(*) FROM movimientos WHERE hora_salida IS NULL AND eliminado_en IS NULL) AS ocupadas_rotacion,
       (SELECT COUNT(*) FROM contratos_alquiler ca JOIN plazas p ON ca.plaza_id = p.id WHERE ca.estado = 'activo' AND ca.fecha_inicio <= CURRENT_DATE AND (ca.fecha_fin IS NULL OR ca.fecha_fin > CURRENT_DATE) AND p.eliminado_en IS NULL) AS ocupadas_alquiler`,
  );

  const occ = occRes.rows[0];
  const totalPlazas = Number(occ?.total_plazas ?? 0);
  const ocupadasRotacion = Number(occ?.ocupadas_rotacion ?? 0);
  const ocupadasAlquiler = Number(occ?.ocupadas_alquiler ?? 0);
  const libres = totalPlazas - ocupadasRotacion - ocupadasAlquiler;

  return {
    periodo: { mes, anio, desde, hasta },
    ingresos: {
      estacionamiento: ing.ingresos.estacionamiento.total,
      alquileres: ing.ingresos.alquileres.total,
      deudas: ing.ingresos.deudas.total,
      total: ing.ingresos.total,
    },
    gastos: {
      total: ing.gastos.total,
      porCategoria: ing.gastos.porCategoria.map((c) => ({ categoria: c.categoria, total: c.total })),
    },
    plazas: {
      total: totalPlazas,
      ocupadasRotacion,
      ocupadasAlquiler,
      libres,
      ocupacionPct: totalPlazas > 0 ? ((ocupadasRotacion + ocupadasAlquiler) / totalPlazas * 100).toFixed(1) : "0.0",
    },
    deudas: { pendientes: Number(deu.rows[0]?.cantidad ?? 0), total: centavosAPesosTexto(Number(deu.rows[0]?.total ?? 0)), vencidas: Number(deu.rows[0]?.vencidas ?? 0) },
    advertencias: [
      "Reporte mensual: consolidado de balance + ocupación al cierre del mes.",
      "Ocupación de rotación = vehículos en plaza ahora; alquiler = contratos activos hoy.",
      "Deudas reflejan estado al cierre del mes (no incluyen pagos del mes sin fecha de pago).",
      ADVERTENCIA_REFERENCIA,
    ],
  };
}
/**
 * ARCA (ex AFIP): resumen de comprobantes emitidos (Recibo C interno).
 */
export async function arca(
  pool: Pool,
  periodo: RangoContable,
): Promise<{
  periodo: RangoContable;
  puntoVenta: number;
  dias: { fecha: string; comprobantes: number; neto: string; iva: string; total: string }[];
  totales: { comprobantes: number; neto: string; iva: string; total: string };
  porFormaPago: { forma_pago: string; operaciones: number; total: string }[];
  advertencias: string[];
}> {
  return enLectura(pool, async (client) => {
    const cfg = await client.query(`SELECT punto_venta FROM configuracion_fiscal WHERE id = 1`);
    const pv = Number(cfg.rows[0]?.punto_venta ?? 1);
    const alicuota = Number((await client.query(`SELECT alicuota_iva FROM configuracion_fiscal WHERE id = 1`)).rows[0]?.alicuota_iva ?? 21);

    const diasRes = await client.query(
      `SELECT DATE(hora_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires') AS fecha,
              COUNT(*)::int AS comprobantes,
              COALESCE(SUM(monto_pagado), 0) AS total_centavos
         FROM movimientos
        WHERE estado_pago = 'pagado'
          AND hora_salida IS NOT NULL
          AND DATE(hora_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2
        GROUP BY fecha
        ORDER BY fecha`,
      [periodo.desde, periodo.hasta],
    );

    const dias = diasRes.rows.map((r) => {
      const totalCentavos = Number(r.total_centavos);
      const { netoCentavos, ivaCentavos } = desglosarIvaInclusive(totalCentavos, alicuota);
      return {
        fecha: r.fecha,
        comprobantes: Number(r.comprobantes),
        neto: centavosAPesosTexto(netoCentavos),
        iva: centavosAPesosTexto(ivaCentavos),
        total: centavosAPesosTexto(totalCentavos),
      };
    });

    const formaRes = await client.query(
      `SELECT COALESCE(forma_pago, 'sin dato') AS forma_pago,
              COUNT(*)::int AS operaciones,
              COALESCE(SUM(monto_pagado), 0) AS total
         FROM movimientos
        WHERE estado_pago = 'pagado'
          AND DATE(hora_entrada AT TIME ZONE 'America/Argentina/Buenos_Aires') BETWEEN $1 AND $2
        GROUP BY forma_pago
        ORDER BY total DESC`,
      [periodo.desde, periodo.hasta],
    );

    const totales = dias.reduce(
      (acc, d) => ({
        comprobantes: acc.comprobantes + d.comprobantes,
        neto: centavosAPesosTexto(pesosTextoACentavos(acc.neto) + pesosTextoACentavos(d.neto)),
        iva: centavosAPesosTexto(pesosTextoACentavos(acc.iva) + pesosTextoACentavos(d.iva)),
        total: centavosAPesosTexto(pesosTextoACentavos(acc.total) + pesosTextoACentavos(d.total)),
      }),
      { comprobantes: 0, neto: "0.00", iva: "0.00", total: "0.00" },
    );

    return {
      periodo,
      puntoVenta: pv,
      dias,
      totales,
      porFormaPago: formaRes.rows.map((r) => ({
        forma_pago: r.forma_pago,
        operaciones: Number(r.operaciones),
        total: centavosAPesosTexto(Number(r.total)),
      })),
      advertencias: [
        "El sistema no emite comprobantes electrónicos: se listan recibos internos como \"Recibo C\".",
        "Neto e IVA calculados sobre precio final usando la alícuota general de configuracion_fiscal.",
        "Formato del Libro IVA Digital (RG 3685/4647): mejora futura.",
        ADVERTENCIA_REFERENCIA,
      ],
    };
  });
}
