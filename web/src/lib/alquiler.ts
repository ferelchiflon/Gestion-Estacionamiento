import type { Pool, PoolClient } from "pg";
import { auditar } from "@/lib/audit";
import { ApiError } from "@/lib/http";
import { centavosAPesosTexto, pesosTextoACentavos } from "@/lib/dinero";
import type { AlquilerActor } from "@/lib/validations/alquiler";

export type ContratoAlquilerFila = {
  id: number;
  plaza_id: number;
  cliente_id: number;
  tipo_alquiler_id: number;
  fecha_inicio: Date | string;
  fecha_fin: Date | string;
  monto_total: string;
  cuota_mensual: string;
  dia_vencimiento: number | null;
  estado: string;
  created_at: Date | string;
  eliminado_en: Date | string | null;
  plaza_numero?: string;
  plaza_sector?: string;
  cliente_nombre?: string;
  tipo_alquiler_nombre?: string;
};

export type PagoAlquilerFila = {
  id: number;
  contrato_id: number;
  periodo: string;
  monto: string;
  fecha_pago: Date | string;
  recibo_id: number | null;
  estado: string;
};

export type ReciboAlquilerFila = {
  id: number;
  numero: number;
  movimiento_id: number | null;
  contrato_id: number | null;
  cliente_id: number | null;
  monto: string;
  forma_pago: string | null;
  fecha_emision: Date | string;
  enviado_email: boolean;
  eliminado_en: Date | string | null;
};

export type DisponibilidadFila = {
  plaza_id: number;
  numero: string;
  sector: string;
  tipo_vehiculo: string;
  estado: "disponible" | "ocupada" | string;
  disponible_desde: Date | string | null;
  etiqueta: string;
};

export type ContratoConDetalle = ContratoAlquilerFila & {
  plaza_numero: string;
  plaza_sector: string;
  cliente_nombre: string;
  tipo_alquiler_nombre: string;
};

export type PagoPendiente = {
  contrato_id: number;
  cliente_nombre: string;
  cliente_email: string;
  cliente_telefono: string | null;
  plaza_numero: string;
  plaza_sector: string;
  cuota_mensual: string;
  dia_vencimiento: number;
  periodo: string;
  dias_retraso: number;
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

function formatearFechaParaEtiqueta(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function getDisponibilidad(
  pool: Pool,
): Promise<DisponibilidadFila[]> {
  const resultado = await pool.query<{
    plaza_id: number;
    numero: string;
    sector: string;
    tipo_vehiculo: string;
    fecha_fin: Date | string | null;
    estado_contrato: string | null;
  }>(
    `SELECT
        p.id as plaza_id,
        p.numero,
        p.sector,
        p.tipo_vehiculo,
        ca.fecha_fin,
        ca.estado as estado_contrato
      FROM plazas p
      LEFT JOIN contratos_alquiler ca ON p.id = ca.plaza_id
        AND ca.estado = 'activo'
        AND ca.fecha_fin >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        AND ca.eliminado_en IS NULL
      WHERE p.eliminado_en IS NULL
      ORDER BY p.sector, p.numero`,
  );

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return resultado.rows.map((row) => {
    const tieneContratoActivo = row.fecha_fin !== null && row.estado_contrato === "activo";
    let estado: DisponibilidadFila["estado"] = "disponible";
    let etiqueta = "Disponible";
    let disponible_desde: Date | null = null;

    if (tieneContratoActivo && row.fecha_fin) {
      const fechaFin = new Date(row.fecha_fin);
      if (fechaFin < hoy) {
        estado = "disponible";
        etiqueta = "Disponible";
      } else {
        estado = "ocupada";
        etiqueta = `Alquilada hasta ${formatearFechaParaEtiqueta(fechaFin)}`;
        disponible_desde = fechaFin;
      }
    }

    return {
      plaza_id: row.plaza_id,
      numero: row.numero,
      sector: row.sector,
      tipo_vehiculo: row.tipo_vehiculo,
      estado,
      disponible_desde,
      etiqueta,
    };
  });
}
export async function getPagosPendientes(
  pool: Pool,
): Promise<PagoPendiente[]> {
  const resultado = await pool.query<PagoPendiente>(
    `SELECT
        ca.id as contrato_id,
        c.nombre as cliente_nombre,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        p.numero as plaza_numero,
        p.sector as plaza_sector,
        ca.cuota_mensual::text as cuota_mensual,
        ca.dia_vencimiento,
        to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM') as periodo
      FROM contratos_alquiler ca
      JOIN clientes c ON ca.cliente_id = c.id
      JOIN plazas p ON ca.plaza_id = p.id
      WHERE ca.estado = 'activo'
        AND ca.tipo_alquiler_id IN (2,3)
        AND ca.eliminado_en IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM pagos_alquiler pa
          WHERE pa.contrato_id = ca.id
            AND pa.periodo = to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM')
            AND pa.estado = 'pagado'
        )
      ORDER BY ca.dia_vencimiento`,
  );

  return resultado.rows.map((p) => {
    const hoy = new Date();
    const vencimiento = new Date(hoy.getFullYear(), hoy.getMonth(), p.dia_vencimiento);
    const dias_retraso = hoy > vencimiento
      ? Math.floor((hoy.getTime() - vencimiento.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      ...p,
      dias_retraso,
    };
  });
}

export async function registrarPago(
  pool: Pool,
  datos: {
    contrato_id: number;
    periodo: string;
    monto: string;
    forma_pago: string;
  },
  actor: AlquilerActor,
): Promise<{ pago: PagoAlquilerFila; recibo: ReciboAlquilerFila }> {
  return enTransaccion(pool, async (client) => {
    const contratoRes = await client.query<{
      id: number;
      cliente_id: number;
      cuota_mensual: string;
      estado: string;
      tipo_alquiler_id: number;
    }>(
      `SELECT id, cliente_id, cuota_mensual::text, estado, tipo_alquiler_id
         FROM contratos_alquiler
        WHERE id = $1 AND eliminado_en IS NULL`,
      [datos.contrato_id],
    );

    if (contratoRes.rowCount === 0) {
      throw new ApiError(404, "CONTRATO_NO_ENCONTRADO", "El contrato no existe");
    }

    const contrato = contratoRes.rows[0];

    if (contrato.estado !== "activo") {
      throw new ApiError(409, "CONTRATO_NO_ACTIVO", "El contrato no está activo");
    }

    if (contrato.tipo_alquiler_id === 1) {
      throw new ApiError(400, "TIPO_NO_PERMITE_PAGOS", "Los contratos diarios no tienen pagos recurrentes");
    }

    const pagoExistente = await client.query<{ id: number }>(
      `SELECT id FROM pagos_alquiler
         WHERE contrato_id = $1 AND periodo = $2 AND estado = 'pagado'`,
      [datos.contrato_id, datos.periodo],
    );

    if ((pagoExistente.rowCount ?? 0) > 0) {
      throw new ApiError(
        409,
        "PAGO_YA_REGISTRADO",
        `Ya existe un pago registrado para el período ${datos.periodo}`,
      );
    }

    const montoCentavos = pesosTextoACentavos(datos.monto);
    const montoPesos = centavosAPesosTexto(montoCentavos);

    const pagoRes = await client.query<PagoAlquilerFila>(
      `INSERT INTO pagos_alquiler
         (contrato_id, periodo, monto, fecha_pago, estado)
       VALUES ($1, $2, $3::numeric, now(), 'pagado')
       RETURNING *`,
      [datos.contrato_id, datos.periodo, montoPesos],
    );

    const pago = pagoRes.rows[0];

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "INSERT",
      tabla: "pagos_alquiler",
      registroId: pago.id,
      despues: pago,
      ip: actor.ip,
    });

    const reciboRes = await client.query<ReciboAlquilerFila>(
      `INSERT INTO recibos
         (contrato_id, cliente_id, monto, forma_pago, fecha_emision)
       VALUES ($1, $2, $3::numeric, $4, now())
       RETURNING *`,
      [datos.contrato_id, contrato.cliente_id, montoPesos, datos.forma_pago],
    );

    const recibo = reciboRes.rows[0];

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "INSERT",
      tabla: "recibos",
      registroId: recibo.id,
      despues: recibo,
      ip: actor.ip,
    });

    return { pago, recibo };
  });
}

export async function listContratos(
  pool: Pool,
): Promise<ContratoConDetalle[]> {
  const resultado = await pool.query<ContratoConDetalle>(
    `SELECT
        ca.*,
        p.numero as plaza_numero,
        p.sector as plaza_sector,
        c.nombre as cliente_nombre,
        ta.nombre as tipo_alquiler_nombre
      FROM contratos_alquiler ca
      JOIN plazas p ON ca.plaza_id = p.id
      JOIN clientes c ON ca.cliente_id = c.id
      JOIN tipos_alquiler ta ON ca.tipo_alquiler_id = ta.id
      WHERE ca.eliminado_en IS NULL
      ORDER BY
        CASE WHEN ca.estado = 'activo' THEN 0 ELSE 1 END,
        ca.fecha_fin ASC`,
  );

  return resultado.rows;
}

export async function crearContrato(
  pool: Pool,
  datos: {
    plaza_id: number;
    cliente_id: number;
    tipo_alquiler_id: number;
    monto_total: string;
    dia_vencimiento: number | null;
  },
  actor: AlquilerActor,
): Promise<ContratoAlquilerFila> {
  return enTransaccion(pool, async (client) => {
    const plazaRes = await client.query<{
      id: number;
      numero: string;
      estado: string;
    }>(
      `SELECT id, numero, estado
         FROM plazas
        WHERE id = $1 AND eliminado_en IS NULL
        FOR UPDATE`,
      [datos.plaza_id],
    );

    if (plazaRes.rowCount === 0) {
      throw new ApiError(404, "PLAZA_NO_ENCONTRADA", "La plaza especificada no existe");
    }

    const plaza = plazaRes.rows[0];

    const solapamiento = await client.query<{ id: number }>(
      `SELECT id
         FROM contratos_alquiler
        WHERE plaza_id = $1
          AND estado = 'activo'
          AND fecha_fin >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
          AND eliminado_en IS NULL`,
      [datos.plaza_id],
    );

    if ((solapamiento.rowCount ?? 0) > 0) {
      throw new ApiError(
        409,
        "PLAZA_CON_CONTRATO_ACTIVO",
        `La plaza ${plaza.numero} ya tiene un contrato activo que se solapa`,
      );
    }

    const clienteRes = await client.query<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM clientes WHERE id = $1 AND eliminado_en IS NULL`,
      [datos.cliente_id],
    );

    if (clienteRes.rowCount === 0) {
      throw new ApiError(404, "CLIENTE_NO_ENCONTRADO", "El cliente especificado no existe");
    }

    const tipoRes = await client.query<{ id: number; nombre: string }>(
      `SELECT id, nombre FROM tipos_alquiler WHERE id = $1`,
      [datos.tipo_alquiler_id],
    );

    if (tipoRes.rowCount === 0) {
      throw new ApiError(404, "TIPO_ALQUILER_NO_ENCONTRADO", "El tipo de alquiler no existe");
    }

    const hoy = new Date();
    const fechaInicio = hoy.toISOString().split("T")[0];
    let fechaFin: string;
    let cuotaMensualCentavos: number;

    const montoTotalCentavos = pesosTextoACentavos(datos.monto_total);

    if (datos.tipo_alquiler_id === 2) {
      const fin = new Date(hoy);
      fin.setMonth(fin.getMonth() + 1);
      fechaFin = fin.toISOString().split("T")[0];
      cuotaMensualCentavos = montoTotalCentavos;
    } else if (datos.tipo_alquiler_id === 3) {
      const fin = new Date(hoy);
      fin.setFullYear(fin.getFullYear() + 1);
      fechaFin = fin.toISOString().split("T")[0];
      cuotaMensualCentavos = Math.round(montoTotalCentavos / 12);
    } else {
      fechaFin = fechaInicio;
      cuotaMensualCentavos = 0;
    }

    if (datos.tipo_alquiler_id === 2 || datos.tipo_alquiler_id === 3) {
      if (datos.dia_vencimiento === null || datos.dia_vencimiento < 1 || datos.dia_vencimiento > 28) {
        throw new ApiError(
          422,
          "DIA_VENCIMIENTO_INVALIDO",
          "El día de vencimiento debe ser entre 1 y 28 para contratos mensuales/anuales",
        );
      }
    }

    const contratoRes = await client.query<ContratoAlquilerFila>(
      `INSERT INTO contratos_alquiler
         (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin,
          monto_total, cuota_mensual, dia_vencimiento, estado)
       VALUES ($1, $2, $3, $4::date, $5::date, $6::numeric, $7::numeric, $8, 'activo')
       RETURNING *`,
      [
        datos.plaza_id,
        datos.cliente_id,
        datos.tipo_alquiler_id,
        fechaInicio,
        fechaFin,
        centavosAPesosTexto(montoTotalCentavos),
        centavosAPesosTexto(cuotaMensualCentavos),
        datos.dia_vencimiento,
      ],
    );

    const contrato = contratoRes.rows[0];

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "INSERT",
      tabla: "contratos_alquiler",
      registroId: contrato.id,
      despues: contrato,
      ip: actor.ip,
    });

    return contrato;
  });
}
