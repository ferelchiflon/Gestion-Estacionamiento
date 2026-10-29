import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { getDeudasUnificadas, marcarDeudaSaldada, registrarPagoParcialDeuda } from "@/lib/deudas";
import { errorResponse, ApiError, clientIp } from "@/lib/http";
import { deudasQuerySchema, marcarSaldadaSchema, registrarPagoParcialSchema } from "@/lib/validations/deudas";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "operaciones.read");

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = deudasQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const resultado = await getDeudasUnificadas(pool, parsed.data);

    return Response.json({
      data: resultado.data,
      resumen: resultado.resumen,
      pagination: {
        page: parsed.data.page ?? 1,
        limit: parsed.data.limit ?? 20,
        total: resultado.total,
        totalPages: Math.ceil(resultado.total / (parsed.data.limit ?? 20)) || 1,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser(["admin", "operador"], "operaciones.write");

    const body = await request.json();

    // Determinar acción por presencia de campos
    const accion = body.accion;

    if (accion === "saldar") {
      const { deuda_id, observacion } = marcarSaldadaSchema.parse(body);

      const pool = getPool();
      await marcarDeudaSaldada(pool, deuda_id, {
        usuarioId: user.id,
        ip: clientIp(request),
      }, observacion);

      return Response.json({ success: true, message: "Deuda marcada como saldada" });
    }

    if (accion === "pago_parcial") {
      const { deuda_id, monto, forma_pago, observacion } = registrarPagoParcialSchema.parse(body);

      const pool = getPool();
      await registrarPagoParcialDeuda(pool, deuda_id, {
        monto,
        forma_pago,
        observacion,
      }, {
        usuarioId: user.id,
        ip: clientIp(request),
      });

      return Response.json({ success: true, message: "Pago parcial registrado" });
    }

    throw new ApiError(400, "INVALID_ACTION", "Acción no válida. Use 'saldar' o 'pago_parcial'");
  } catch (error) {
    return errorResponse(error);
  }
}