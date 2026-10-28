import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { registrarEgreso } from "@/lib/movimientos";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
} from "@/lib/http";
import { egresoCobroSchema } from "@/lib/validations/modulo4";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");

    const body = await request.json();
    const data = egresoCobroSchema.parse(body);

    // Toda la regla de negocio (lock FOR UPDATE del movimiento, cálculo del
    // monto en el servidor en centavos enteros, idempotencia del cobro,
    // recibo, deuda, saldo del cliente y auditoría) corre dentro de UNA
    // única transacción en registrarEgreso.
    const resultado = await registrarEgreso(getPool(), data, {
      usuarioId: user.id,
      ip: clientIp(request),
    });

    return Response.json({
      movimiento: resultado.movimiento,
      recibo: resultado.recibo,
      calculo: resultado.calculo,
      idempotente: resultado.idempotente,
      ...(resultado.idempotente
        ? { mensaje: "El movimiento ya fue cobrado previamente." }
        : {}),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
