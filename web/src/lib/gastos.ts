import type { Pool, PoolClient } from "pg";
import { auditar } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { centavosAPesosTexto, pesosTextoACentavos } from "@/lib/dinero";
import type { GastoActor } from "@/lib/validations/gastos";

export type GastoFila = {
  id: number;
  fecha: Date | string;
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
  categoria_id: number | null;
  categoria_nombre: string | null;
  forma_pago: string | null;
  notas: string | null;
  created_at: Date | string;
  eliminado_en: Date | string | null;
};

export type GastoTotales = {
  neto_gravado: string;
  iva_21: string;
  iva_105: string;
  iva_27: string;
  iva: string;
  no_gravado: string;
  percepcion_iva: string;
  percepcion_iibb: string;
  total: string;
  comprobantes: number;
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

function sumarComponentesEnCentavos(
  neto_gravado: string,
  iva_21: string,
  iva_105: string,
  iva_27: string,
  no_gravado: string,
  percepcion_iva: string,
  percepcion_iibb: string,
): number {
  return (
    pesosTextoACentavos(neto_gravado) +
    pesosTextoACentavos(iva_21) +
    pesosTextoACentavos(iva_105) +
    pesosTextoACentavos(iva_27) +
    pesosTextoACentavos(no_gravado) +
    pesosTextoACentavos(percepcion_iva) +
    pesosTextoACentavos(percepcion_iibb)
  );
}

/** Normaliza CUIT: quita guiones y deja solo 11 dígitos. */
function normalizarCuit(cuit: string | null | undefined): string | null {
  if (!cuit) return null;
  const soloDigitos = cuit.replace(/\D/g, "");
  return soloDigitos.length === 11 ? soloDigitos : null;
}

/** Traduce la violación del índice único de comprobante (23505) a GASTO_DUPLICADO 409. */
function esViolacionComprobanteUnico(error: unknown): boolean {
  const pgError = error as { code?: string; constraint?: string };
  return (
    pgError?.code === "23505" &&
    pgError?.constraint === "uq_gastos_compras_cuit_comprobante"
  );
}

export async function crearGasto(
  pool: Pool,
  datos: {
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
    categoria_id: number | null;
    forma_pago: string | null;
    notas: string | null;
  },
  actor: GastoActor,
): Promise<GastoFila> {
  const totalCentavos = sumarComponentesEnCentavos(
    datos.neto_gravado,
    datos.iva_21,
    datos.iva_105,
    datos.iva_27,
    datos.no_gravado,
    datos.percepcion_iva,
    datos.percepcion_iibb,
  );
  const total = centavosAPesosTexto(totalCentavos);

  // Normalizar CUIT a 11 dígitos (sin guiones) para el índice único
  const cuitNormalizado = normalizarCuit(datos.cuit_proveedor);

  return enTransaccion(pool, async (client) => {
    let res;
    try {
      res = await client.query<GastoFila>(
        `INSERT INTO gastos_compras
           (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante,
            neto_gravado, iva_21, iva_105, iva_27, no_gravado, percepcion_iva, percepcion_iibb,
            total, categoria_id, forma_pago, notas)
         VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9::numeric, $10::numeric,
                 $11::numeric, $12::numeric, $13::numeric, $14::numeric, $15, $16, $17)
         RETURNING
           id, fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante,
           neto_gravado, iva_21, iva_105, iva_27, no_gravado, percepcion_iva, percepcion_iibb,
           total, categoria_id, forma_pago, notas, created_at, eliminado_en`,
        [
          datos.fecha,
          datos.proveedor,
          cuitNormalizado,
          datos.tipo_comprobante,
          datos.punto_venta,
          datos.numero_comprobante,
          datos.neto_gravado,
          datos.iva_21,
          datos.iva_105,
          datos.iva_27,
          datos.no_gravado,
          datos.percepcion_iva,
          datos.percepcion_iibb,
          total,
          datos.categoria_id,
          datos.forma_pago,
          datos.notas,
        ],
      );
    } catch (error) {
      if (esViolacionComprobanteUnico(error)) {
        throw new ApiError(
          409,
          "GASTO_DUPLICADO",
          "Ya existe un comprobante con ese tipo, punto de venta, número y proveedor",
        );
      }
      throw error;
    }

    const gasto = res.rows[0];

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "INSERT",
      tabla: "gastos_compras",
      registroId: gasto.id,
      despues: gasto,
      ip: actor.ip,
    });

    return gasto;
  });
}

export async function listarGastos(
  pool: Pool,
  filtros: {
    fecha_desde?: string;
    fecha_hasta?: string;
    categoria_id?: number;
    proveedor?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ data: GastoFila[]; total: number }> {
  const { fecha_desde, fecha_hasta, categoria_id, proveedor, limit = 50, offset = 0 } = filtros;

  let whereClause = "WHERE g.eliminado_en IS NULL";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (fecha_desde) {
    whereClause += ` AND g.fecha >= $${paramIndex}`;
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    whereClause += ` AND g.fecha <= $${paramIndex}`;
    params.push(fecha_hasta);
    paramIndex++;
  }

  if (categoria_id) {
    whereClause += ` AND g.categoria_id = $${paramIndex}`;
    params.push(categoria_id);
    paramIndex++;
  }

  if (proveedor) {
    whereClause += ` AND g.proveedor ILIKE $${paramIndex}`;
    params.push(`%${proveedor}%`);
    paramIndex++;
  }

  const countRes = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM gastos_compras g ${whereClause}`,
    params,
  );
  const total = countRes.rows[0].total;

  params.push(limit, offset);
  const dataRes = await pool.query<GastoFila>(
    `SELECT
       g.id, g.fecha, g.proveedor, g.cuit_proveedor, g.tipo_comprobante, g.punto_venta,
       g.numero_comprobante, g.neto_gravado, g.iva_21, g.iva_105, g.iva_27,
       g.no_gravado, g.percepcion_iva, g.percepcion_iibb, g.total,
       g.categoria_id, c.nombre AS categoria_nombre, g.forma_pago, g.notas,
       g.created_at, g.eliminado_en
     FROM gastos_compras g
     LEFT JOIN categorias_gasto c ON g.categoria_id = c.id
     ${whereClause}
     ORDER BY g.fecha DESC, g.id DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params,
  );

  return { data: dataRes.rows, total };
}

export async function totalesGastos(
  pool: Pool,
  filtros: {
    fecha_desde?: string;
    fecha_hasta?: string;
    categoria_id?: number;
    proveedor?: string;
  } = {},
): Promise<GastoTotales> {
  const { fecha_desde, fecha_hasta, categoria_id, proveedor } = filtros;

  let whereClause = "WHERE g.eliminado_en IS NULL";
  const params: unknown[] = [];
  let paramIndex = 1;

  if (fecha_desde) {
    whereClause += ` AND g.fecha >= $${paramIndex}`;
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    whereClause += ` AND g.fecha <= $${paramIndex}`;
    params.push(fecha_hasta);
    paramIndex++;
  }

  if (categoria_id) {
    whereClause += ` AND g.categoria_id = $${paramIndex}`;
    params.push(categoria_id);
    paramIndex++;
  }

  if (proveedor) {
    whereClause += ` AND g.proveedor ILIKE $${paramIndex}`;
    params.push(`%${proveedor}%`);
    paramIndex++;
  }

  const res = await pool.query<GastoTotales>(
    `SELECT
       COALESCE(SUM(neto_gravado), 0)::text              AS neto_gravado,
       COALESCE(SUM(iva_21), 0)::text                    AS iva_21,
       COALESCE(SUM(iva_105), 0)::text                   AS iva_105,
       COALESCE(SUM(iva_27), 0)::text                    AS iva_27,
       COALESCE(SUM(iva_21 + iva_105 + iva_27), 0)::text AS iva,
       COALESCE(SUM(no_gravado), 0)::text                AS no_gravado,
       COALESCE(SUM(percepcion_iva), 0)::text            AS percepcion_iva,
       COALESCE(SUM(percepcion_iibb), 0)::text           AS percepcion_iibb,
       COALESCE(SUM(total), 0)::text                     AS total,
       COUNT(*)::int                                     AS comprobantes
     FROM gastos_compras g
     ${whereClause}`,
    params,
  );

  return res.rows[0];
}

export async function obtenerGasto(
  pool: Pool,
  id: number,
): Promise<GastoFila | null> {
  const res = await pool.query<GastoFila>(
    `SELECT
       g.id, g.fecha, g.proveedor, g.cuit_proveedor, g.tipo_comprobante, g.punto_venta,
       g.numero_comprobante, g.neto_gravado, g.iva_21, g.iva_105, g.iva_27,
       g.no_gravado, g.percepcion_iva, g.percepcion_iibb, g.total,
       g.categoria_id, c.nombre AS categoria_nombre, g.forma_pago, g.notas,
       g.created_at, g.eliminado_en
     FROM gastos_compras g
     LEFT JOIN categorias_gasto c ON g.categoria_id = c.id
     WHERE g.id = $1 AND g.eliminado_en IS NULL`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function actualizarGasto(
  pool: Pool,
  id: number,
  datos: {
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
    categoria_id: number | null;
    forma_pago: string | null;
    notas: string | null;
  },
  actor: GastoActor,
): Promise<GastoFila> {
  const totalCentavos = sumarComponentesEnCentavos(
    datos.neto_gravado,
    datos.iva_21,
    datos.iva_105,
    datos.iva_27,
    datos.no_gravado,
    datos.percepcion_iva,
    datos.percepcion_iibb,
  );
  const total = centavosAPesosTexto(totalCentavos);

  // Normalizar CUIT a 11 dígitos (sin guiones) para el índice único
  const cuitNormalizado = normalizarCuit(datos.cuit_proveedor);

  return enTransaccion(pool, async (client) => {
    const anteriorRes = await client.query<GastoFila>(
      `SELECT * FROM gastos_compras WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );

    if (anteriorRes.rowCount === 0) {
      throw new ApiError(404, "GASTO_NO_ENCONTRADO", "El gasto no existe");
    }

    const anterior = anteriorRes.rows[0];

    const res = await client.query<GastoFila>(
      `UPDATE gastos_compras
          SET fecha = $1, proveedor = $2, cuit_proveedor = $3,
              tipo_comprobante = $4, punto_venta = $5, numero_comprobante = $6,
              neto_gravado = $7::numeric, iva_21 = $8::numeric, iva_105 = $9::numeric,
              iva_27 = $10::numeric, no_gravado = $11::numeric,
              percepcion_iva = $12::numeric, percepcion_iibb = $13::numeric,
              total = $14::numeric, categoria_id = $15, forma_pago = $16, notas = $17
        WHERE id = $18 AND eliminado_en IS NULL
        RETURNING
          id, fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante,
          neto_gravado, iva_21, iva_105, iva_27, no_gravado, percepcion_iva, percepcion_iibb,
          total, categoria_id, forma_pago, notas, created_at, eliminado_en`,
      [
        datos.fecha,
        datos.proveedor,
        cuitNormalizado,
        datos.tipo_comprobante,
        datos.punto_venta,
        datos.numero_comprobante,
        datos.neto_gravado,
        datos.iva_21,
        datos.iva_105,
        datos.iva_27,
        datos.no_gravado,
        datos.percepcion_iva,
        datos.percepcion_iibb,
        total,
        datos.categoria_id,
        datos.forma_pago,
        datos.notas,
        id,
      ],
    );

    const gasto = res.rows[0];

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      tabla: "gastos_compras",
      registroId: id,
      antes: anterior,
      despues: gasto,
      ip: actor.ip,
    });

    return gasto;
  });
}

export async function eliminarGasto(
  pool: Pool,
  id: number,
  actor: GastoActor,
): Promise<void> {
  await enTransaccion(pool, async (client) => {
    const anteriorRes = await client.query<GastoFila>(
      `SELECT * FROM gastos_compras WHERE id = $1 AND eliminado_en IS NULL`,
      [id],
    );

    if (anteriorRes.rowCount === 0) {
      throw new ApiError(404, "GASTO_NO_ENCONTRADO", "El gasto no existe");
    }

    const anterior = anteriorRes.rows[0];

    await client.query(
      `UPDATE gastos_compras SET eliminado_en = now() WHERE id = $1`,
      [id],
    );

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "DELETE",
      tabla: "gastos_compras",
      registroId: id,
      antes: anterior,
      despues: { eliminado_en: new Date().toISOString() },
      ip: actor.ip,
    });
  });
}

export async function listarCategorias(
  pool: Pool,
): Promise<{ id: number; nombre: string }[]> {
  const res = await pool.query<{ id: number; nombre: string }>(
    `SELECT id, nombre FROM categorias_gasto WHERE activa = true ORDER BY nombre`,
  );
  return res.rows;
}