import type { Pool, PoolClient } from "pg";
import { auditar } from "@/lib/audit";
import { calcularMontoEstadia, type CalculoEstadia } from "@/lib/calculo-estadia";
import { centavosAPesosTexto, pesosTextoACentavos } from "@/lib/dinero";
import { ApiError } from "@/lib/http";
import type {
  EgresoCobroInput,
  IngresoInput,
} from "@/lib/validations/modulo4";

export type MovimientoActor = {
  usuarioId: number;
  ip?: string | null;
};

export type MovimientoFila = {
  id: number;
  patente: string;
  plaza_id: number;
  hora_entrada: Date | string;
  hora_salida: Date | string | null;
  monto_calculado: string;
  monto_pagado: string;
  estado_pago: string;
  forma_pago: string | null;
  vehiculo_tipo?: string | null;
  cliente_id?: number | null;
  [campo: string]: unknown;
};

export type ReciboFila = {
  id: number;
  movimiento_id: number;
  cliente_id: number | null;
  monto: string;
  forma_pago: string;
  fecha_emision: Date | string;
  [campo: string]: unknown;
};

export type ResultadoIngreso = {
  movimiento: MovimientoFila;
};

export type ResultadoEgreso = {
  movimiento: MovimientoFila;
  recibo: ReciboFila | null;
  calculo: CalculoEstadia | null;
  idempotente: boolean;
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

async function tarifaVigenteEnCentavos(
  client: PoolClient,
  tipoVehiculo: string,
): Promise<number> {
  const resultado = await client.query<{ tarifa_hora_centavos: number }>(
    `SELECT (tarifa_hora * 100)::int AS tarifa_hora_centavos
       FROM tarifas
      WHERE tipo_vehiculo = $1
        AND fecha_desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
        AND (fecha_hasta IS NULL OR fecha_hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
        AND eliminado_en IS NULL
      ORDER BY fecha_desde DESC
      LIMIT 1`,
    [tipoVehiculo],
  );

  if (resultado.rowCount === 0) {
    throw new ApiError(
      422,
      "TARIFA_NO_VIGENTE",
      "No hay tarifa vigente para este tipo de vehículo",
    );
  }

  const centavos = resultado.rows[0].tarifa_hora_centavos;
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error("La tarifa vigente no es un entero válido de centavos");
  }
  return centavos;
}

export async function registrarIngreso(
  pool: Pool,
  datos: IngresoInput,
  actor: MovimientoActor,
): Promise<ResultadoIngreso> {
  return enTransaccion(pool, async (client) => {
    // La plaza es el recurso serializado: dos ingresos a la misma plaza compiten por este lock.
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
    if (plaza.estado !== "libre") {
      throw new ApiError(
        409,
        "PLAZA_OCUPADA",
        `La plaza ${plaza.numero} no está libre (estado: ${plaza.estado})`,
      );
    }

    // Advisory lock evita dos movimientos abiertos de la misma patente aun en plazas distintas.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [datos.patente]);

    const abiertoRes = await client.query<{ id: number; plaza_id: number }>(
      `SELECT id, plaza_id
         FROM movimientos
        WHERE patente = $1 AND hora_salida IS NULL AND eliminado_en IS NULL
        FOR UPDATE`,
      [datos.patente],
    );
    if (abiertoRes.rowCount && abiertoRes.rowCount > 0) {
      throw new ApiError(
        409,
        "PATENTE_CON_MOVIMIENTO_ABIERTO",
        `El vehículo con patente ${datos.patente} ya tiene un ingreso abierto en la plaza ID ${abiertoRes.rows[0].plaza_id}`,
      );
    }

    const vehiculoRes = await client.query<{
      id: number;
      cliente_id: number | null;
      tipo: string;
    }>(
      `SELECT id, cliente_id, tipo
         FROM vehiculos
        WHERE patente = $1 AND eliminado_en IS NULL
        FOR UPDATE`,
      [datos.patente],
    );

    let clienteId = datos.cliente_id ?? null;
    if (vehiculoRes.rowCount && vehiculoRes.rowCount > 0) {
      clienteId ??= vehiculoRes.rows[0].cliente_id;
    } else {
      await client.query(
        `INSERT INTO vehiculos (patente, tipo, marca, modelo, color, cliente_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (patente) DO UPDATE
           SET eliminado_en = NULL,
               tipo = EXCLUDED.tipo,
               marca = COALESCE(EXCLUDED.marca, vehiculos.marca)`,
        [
          datos.patente,
          datos.tipo_vehiculo,
          datos.marca ?? null,
          datos.modelo ?? null,
          datos.color ?? null,
          clienteId,
        ],
      );
    }

    const movimientoRes = await client.query<MovimientoFila>(
      `INSERT INTO movimientos (patente, plaza_id, hora_entrada, estado_pago)
       VALUES ($1, $2, now(), 'pendiente')
       RETURNING *`,
      [datos.patente, datos.plaza_id],
    );
    const movimiento = movimientoRes.rows[0];

    const plazaActualizadaRes = await client.query<{ estado: string }>(
      `UPDATE plazas SET estado = 'ocupada' WHERE id = $1 RETURNING estado`,
      [datos.plaza_id],
    );

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "INSERT",
      tabla: "movimientos",
      registroId: movimiento.id,
      despues: movimiento,
      ip: actor.ip,
    });
    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      tabla: "plazas",
      registroId: datos.plaza_id,
      antes: { estado: plaza.estado },
      despues: plazaActualizadaRes.rows[0],
      ip: actor.ip,
    });

    return { movimiento };
  });
}


export async function registrarEgreso(
  pool: Pool,
  datos: EgresoCobroInput,
  actor: MovimientoActor,
): Promise<ResultadoEgreso> {
  return enTransaccion(pool, async (client) => {
    // El lock serializa dos cobros simultáneos del mismo movimiento.
    const movimientoRes = await client.query<MovimientoFila>(
      `SELECT m.*, v.tipo AS vehiculo_tipo, v.cliente_id
         FROM movimientos m
         LEFT JOIN vehiculos v
           ON m.patente = v.patente AND v.eliminado_en IS NULL
        WHERE m.id = $1 AND m.eliminado_en IS NULL
        FOR UPDATE OF m`,
      [datos.movimiento_id],
    );

    if (movimientoRes.rowCount === 0) {
      throw new ApiError(404, "MOVIMIENTO_NO_ENCONTRADO", "Movimiento no encontrado");
    }

    const movimientoAnterior = movimientoRes.rows[0];

    // Una segunda petición espera el lock y luego observa el resultado de la primera.
    if (movimientoAnterior.hora_salida !== null) {
      const reciboRes = await client.query<ReciboFila>(
        `SELECT * FROM recibos
          WHERE movimiento_id = $1 AND eliminado_en IS NULL
          ORDER BY id
          LIMIT 1`,
        [datos.movimiento_id],
      );
      return {
        movimiento: movimientoAnterior,
        recibo: reciboRes.rows[0] ?? null,
        calculo: null,
        idempotente: true,
      };
    }

    const horaSalida = new Date();
    const tipoVehiculo = (movimientoAnterior.vehiculo_tipo as string | null) ?? "auto";
    const tarifaCentavos = await tarifaVigenteEnCentavos(client, tipoVehiculo);
    const calculo = calcularMontoEstadia(
      movimientoAnterior.hora_entrada as string,
      horaSalida,
      tarifaCentavos,
    );
    const montoPesos = calculo.montoTotalPesos;

    let clienteId = (movimientoAnterior.cliente_id as number | null) ?? null;
    if (clienteId === null) {
      const clienteRes = await client.query<{ cliente_id: number | null }>(
        `SELECT cliente_id FROM vehiculos
          WHERE patente = $1 AND eliminado_en IS NULL`,
        [movimientoAnterior.patente],
      );
      clienteId = clienteRes.rows[0]?.cliente_id ?? null;
    }

    let estadoPago = "pagado";
    let montoPagado = montoPesos;

    if (datos.registrar_como_deuda) {
      if (clienteId === null) {
        throw new ApiError(
          400,
          "CLIENTE_REQUERIDO_PARA_DEUDA",
          "Para registrar una deuda, el vehículo debe pertenecer a un cliente registrado",
        );
      }
      estadoPago = "deuda";
      montoPagado = "0.00";
    } else if (datos.forma_pago === "saldo_prepago") {
      if (clienteId === null) {
        throw new ApiError(
          400,
          "CLIENTE_SIN_SALDO",
          "No se puede pagar con saldo prepago un vehículo sin cliente registrado",
        );
      }

      const clienteRes = await client.query<{
        id: number;
        saldo_actual: string;
      }>(
        `SELECT id, saldo_actual::text
           FROM clientes
          WHERE id = $1 AND eliminado_en IS NULL
          FOR UPDATE`,
        [clienteId],
      );
      const cliente = clienteRes.rows[0];
      if (!cliente) {
        throw new ApiError(404, "CLIENTE_NO_ENCONTRADO", "Cliente no encontrado");
      }

      const saldoCentavos = pesosTextoACentavos(cliente.saldo_actual);
      const montoCentavos = calculo.montoTotalCentavos;
      if (saldoCentavos >= montoCentavos) {
        const saldoRestante = centavosAPesosTexto(saldoCentavos - montoCentavos);
        await client.query(
          "UPDATE clientes SET saldo_actual = $1::numeric WHERE id = $2",
          [saldoRestante, clienteId],
        );
        await auditar(client, {
          usuarioId: actor.usuarioId,
          accion: "UPDATE",
          tabla: "clientes",
          registroId: clienteId,
          antes: { saldo_actual: cliente.saldo_actual },
          despues: { saldo_actual: saldoRestante },
          ip: actor.ip,
        });
      } else {
        estadoPago = "deuda";
        montoPagado = "0.00";
      }
    }

    if (estadoPago === "deuda" && clienteId !== null) {
      await client.query(
        `INSERT INTO deudas
           (cliente_id, movimiento_id, monto_original, monto_con_interes, fecha_vencimiento, estado)
         VALUES ($1, $2, $3::numeric, $3::numeric,
                 (now() AT TIME ZONE 'America/Argentina/Buenos_Aires' + interval '7 days')::date,
                 'pendiente')`,
        [clienteId, datos.movimiento_id, montoPesos],
      );
    }

    const movimientoActualizadoRes = await client.query<MovimientoFila>(
      `UPDATE movimientos
          SET hora_salida = $1,
              monto_calculado = $2::numeric,
              monto_pagado = $3::numeric,
              estado_pago = $4,
              forma_pago = $5
        WHERE id = $6
        RETURNING *`,
      [horaSalida, montoPesos, montoPagado, estadoPago, datos.forma_pago, datos.movimiento_id],
    );
    const movimientoActualizado = movimientoActualizadoRes.rows[0];

    let recibo: ReciboFila | null = null;
    if (estadoPago === "pagado") {
      const reciboRes = await client.query<ReciboFila>(
        `INSERT INTO recibos (movimiento_id, cliente_id, monto, forma_pago, fecha_emision)
         VALUES ($1, $2, $3::numeric, $4, $5)
         RETURNING *`,
        [datos.movimiento_id, clienteId, montoPagado, datos.forma_pago, horaSalida],
      );
      recibo = reciboRes.rows[0];

      await auditar(client, {
        usuarioId: actor.usuarioId,
        accion: "INSERT",
        tabla: "recibos",
        registroId: recibo.id,
        despues: recibo,
        ip: actor.ip,
      });
    }

    const plazaRes = await client.query<{ estado: string }>(
      `UPDATE plazas SET estado = 'libre' WHERE id = $1 RETURNING estado`,
      [movimientoAnterior.plaza_id],
    );

    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      tabla: "movimientos",
      registroId: datos.movimiento_id,
      antes: movimientoAnterior,
      despues: movimientoActualizado,
      ip: actor.ip,
    });
    await auditar(client, {
      usuarioId: actor.usuarioId,
      accion: "UPDATE",
      tabla: "plazas",
      registroId: movimientoAnterior.plaza_id,
      antes: { estado: "ocupada" },
      despues: plazaRes.rows[0],
      ip: actor.ip,
    });

    return {
      movimiento: movimientoActualizado,
      recibo,
      calculo,
      idempotente: false,
    };
  });
}

