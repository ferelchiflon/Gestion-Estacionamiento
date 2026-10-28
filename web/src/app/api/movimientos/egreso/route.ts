import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { egresoCobroSchema } from "@/lib/validations/modulo4";
import { obtenerTarifaVigente } from "@/lib/tarifas";
import { calcularMontoEstadia } from "@/lib/calculo-estadia";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");

    const body = await request.json();
    const data = egresoCobroSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Bloquear el movimiento con FOR UPDATE
      const movRes = await client.query(
        `SELECT m.*, v.tipo as vehiculo_tipo, v.cliente_id
         FROM movimientos m
         LEFT JOIN vehiculos v ON m.patente = v.patente AND v.eliminado_en IS NULL
         WHERE m.id = $1 AND m.eliminado_en IS NULL
         FOR UPDATE OF m`,
        [data.movimiento_id]
      );

      if (movRes.rowCount === 0) {
        throw new ApiError(404, "MOVIMIENTO_NO_ENCONTRADO", "Movimiento no encontrado");
      }

      const mov = movRes.rows[0];

      // IDEMPOTENCIA: Si ya tiene hora_salida, no duplicar cobro ni recibo. Retornar el existente.
      if (mov.hora_salida !== null) {
        const reciboExistente = await client.query(
          "SELECT * FROM recibos WHERE movimiento_id = $1 AND eliminado_en IS NULL",
          [mov.id]
        );
        await client.query("ROLLBACK");
        return Response.json({
          movimiento: mov,
          recibo: reciboExistente.rows[0] ?? null,
          idempotente: true,
          mensaje: "El movimiento ya fue cerrado previamente.",
        });
      }

      const horaSalida = new Date();

      // 2. Obtener tarifa vigente y calcular en el SERVIDOR (en centavos enteros)
      const tipoVehiculo = mov.vehiculo_tipo || "auto";
      const tarifaVigente = await obtenerTarifaVigente(tipoVehiculo, horaSalida, client);
      const tarifaCentavos = tarifaVigente?.tarifa_hora_centavos ?? 150000; // $1500 default si no hay
      const calculo = calcularMontoEstadia(mov.hora_entrada, horaSalida, tarifaCentavos);
      const montoPesos = calculo.montoTotalPesos;

      // 3. Evaluar forma de pago y cliente
      let estadoPago = "pagado";
      let montoPagado = montoPesos;
      let clienteId = mov.cliente_id ?? null;

      // Buscar cliente asociado por si no estaba en la consulta
      if (!clienteId) {
        const cliRes = await client.query(
          "SELECT cliente_id FROM vehiculos WHERE patente = $1 AND eliminado_en IS NULL",
          [mov.patente]
        );
        clienteId = cliRes.rows[0]?.cliente_id ?? null;
      }

      if (data.registrar_como_deuda) {
        if (!clienteId) {
          throw new ApiError(
            400,
            "CLIENTE_REQUERIDO_PARA_DEUDA",
            "Para registrar una deuda, el vehículo debe pertenecer a un cliente registrado"
          );
        }
        estadoPago = "deuda";
        montoPagado = 0;
      } else if (data.forma_pago === "saldo_prepago") {
        if (!clienteId) {
          throw new ApiError(
            400,
            "CLIENTE_SIN_SALDO",
            "No se puede pagar con saldo prepago un vehículo sin cliente registrado"
          );
        }

        // Consultar y bloquear saldo del cliente
        const clienteRes = await client.query(
          "SELECT id, saldo_actual FROM clientes WHERE id = $1 AND eliminado_en IS NULL FOR UPDATE",
          [clienteId]
        );

        const saldoActual = Number(clienteRes.rows[0]?.saldo_actual ?? 0);
        if (saldoActual >= montoPesos) {
          await client.query(
            "UPDATE clientes SET saldo_actual = saldo_actual - $1 WHERE id = $2",
            [montoPesos, clienteId]
          );
        } else {
          // Saldo insuficiente: se manda a deuda
          estadoPago = "deuda";
          montoPagado = 0;
        }
      }

      // 4. Si es deuda, registrar en tabla deudas (vencimiento a 7 días en hora argentina)
      if (estadoPago === "deuda" && clienteId) {
        await client.query(
          `INSERT INTO deudas 
             (cliente_id, movimiento_id, monto_original, monto_con_interes, fecha_vencimiento, estado)
           VALUES 
             ($1, $2, $3, $3, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires' + interval '7 days')::date, 'pendiente')`,
          [clienteId, mov.id, montoPesos]
        );
      }

      // 5. Actualizar movimiento
      const movUpdateRes = await client.query(
        `UPDATE movimientos
         SET hora_salida = $1,
             monto_calculado = $2,
             monto_pagado = $3,
             estado_pago = $4,
             forma_pago = $5
         WHERE id = $6
         RETURNING *`,
        [horaSalida, montoPesos, montoPagado, estadoPago, data.forma_pago, mov.id]
      );
      const movimientoActualizado = movUpdateRes.rows[0];

      // 6. Si está pagado, emitir recibo con secuencia atómica
      let recibo = null;
      if (estadoPago === "pagado") {
        const reciboRes = await client.query(
          `INSERT INTO recibos (movimiento_id, cliente_id, monto, forma_pago, fecha_emision)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [mov.id, clienteId, montoPagado, data.forma_pago, horaSalida]
        );
        recibo = reciboRes.rows[0];

        await auditar(client, {
          usuarioId: user.id,
          accion: "INSERT",
          tabla: "recibos",
          registroId: recibo.id,
          despues: recibo,
          ip: clientIp(request),
        });
      }

      // 7. Liberar la plaza
      await client.query(
        "UPDATE plazas SET estado = 'libre' WHERE id = $1",
        [mov.plaza_id]
      );

      // 8. Auditar egreso
      await auditar(client, {
        usuarioId: user.id,
        accion: "UPDATE",
        tabla: "movimientos",
        registroId: mov.id,
        antes: mov,
        despues: movimientoActualizado,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json({
        movimiento: movimientoActualizado,
        recibo,
        calculo,
      });
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
