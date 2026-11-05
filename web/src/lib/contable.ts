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

