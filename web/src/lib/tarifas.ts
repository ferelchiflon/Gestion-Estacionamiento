import { getPool } from "@/lib/db";
import { pesosTextoACentavos } from "@/lib/dinero";
import { type TipoVehiculo } from "@/lib/validations/modulo3";
import { TIMEZONE_AR } from "@/lib/format";
import type { PoolClient } from "pg";

export type TarifaVigente = {
  id: number;
  tipo_vehiculo: TipoVehiculo;
  tarifa_hora: string; // Numeric PostgreSQL exacto, por ejemplo "1500.50"
  tarifa_hora_centavos: number; // Enteros para cálculos seguros
  fecha_desde: string;
  fecha_hasta: string | null;
};

/**
 * Obtiene la tarifa horaria vigente para un tipo de vehículo en una fecha dada.
 * Si no se especifica fecha, toma la fecha actual en America/Argentina/Buenos_Aires.
 * Retorna tanto el valor nominal como los centavos enteros.
 */
export async function obtenerTarifaVigente(
  tipoVehiculo: TipoVehiculo,
  fecha?: Date | string | null,
  client?: PoolClient
): Promise<TarifaVigente | null> {
  const runner = client ?? getPool();

  // Resolver la fecha en formato YYYY-MM-DD según la zona de Argentina
  let fechaSql: string;
  if (!fecha) {
    const ahora = new Date();
    // Formatear en YYYY-MM-DD en timezone AR
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE_AR,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    fechaSql = formatter.format(ahora);
  } else if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fechaSql = fecha;
  } else {
    const d = typeof fecha === "string" ? new Date(fecha) : fecha;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE_AR,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    fechaSql = formatter.format(d);
  }

  const query = `
    SELECT 
      id,
      tipo_vehiculo,
      tarifa_hora::numeric(14,2)::text AS tarifa_hora,
      (tarifa_hora * 100)::int AS tarifa_hora_centavos,
      to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
      to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta
    FROM tarifas
    WHERE tipo_vehiculo = $1
      AND fecha_desde <= $2::date
      AND (fecha_hasta IS NULL OR fecha_hasta >= $2::date)
      AND eliminado_en IS NULL
    ORDER BY fecha_desde DESC
    LIMIT 1
  `;

  const res = await runner.query(query, [tipoVehiculo, fechaSql]);

  if (res.rowCount === 0) {
    return null;
  }

  const row = res.rows[0];
  const tarifaCentavos = Number(row.tarifa_hora_centavos);
  if (!Number.isSafeInteger(tarifaCentavos)) {
    throw new Error("La tarifa vigente excede el rango seguro de centavos");
  }

  // Respaldo defensivo para respuestas numéricasapedidas como string.
  const tarifaCentavosDesdeTexto = pesosTextoACentavos(row.tarifa_hora);
  if (tarifaCentavos !== tarifaCentavosDesdeTexto) {
    throw new Error("La tarifa vigente no es consistente en centavos");
  }

  return {
    id: row.id,
    tipo_vehiculo: row.tipo_vehiculo as TipoVehiculo,
    tarifa_hora: row.tarifa_hora,
    tarifa_hora_centavos: tarifaCentavos,
    fecha_desde: row.fecha_desde,
    fecha_hasta: row.fecha_hasta,
  };
}

/**
 * Verifica si existe un solapamiento de fechas para un tipo de vehículo.
 * Regla: Dos tarifas para el mismo tipo_vehiculo no pueden intersectar sus rangos
 * [fecha_desde, COALESCE(fecha_hasta, 'infinity')].
 */
export async function verificarSolapamientoTarifa(
  tipoVehiculo: TipoVehiculo,
  fechaDesde: string,
  fechaHasta: string | null | undefined,
  excluirId?: number,
  client?: PoolClient
): Promise<boolean> {
  const runner = client ?? getPool();

  const query = `
    SELECT id FROM tarifas
    WHERE tipo_vehiculo = $1
      AND eliminado_en IS NULL
      ${excluirId ? "AND id <> $4" : ""}
      AND daterange(fecha_desde, COALESCE(fecha_hasta, 'infinity'::date), '[]')
          && daterange($2::date, COALESCE($3::date, 'infinity'::date), '[]')
    LIMIT 1
  `;

  const params: unknown[] = [tipoVehiculo, fechaDesde, fechaHasta || null];
  if (excluirId) {
    params.push(excluirId);
  }

  const res = await runner.query(query, params);
  return (res.rowCount ?? 0) > 0;
}
