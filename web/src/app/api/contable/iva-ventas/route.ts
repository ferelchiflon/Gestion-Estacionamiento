import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ivaVentas } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";

/**
 * Reporte de IVA de ventas — REFERENCIA INTERNA.
 * No es una declaración jurada ni genera archivos oficiales.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "contador"], "fiscal.read");

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = contableQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const reporte = await ivaVentas(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      return csvResponse(
        `iva_ventas_${parsed.data.desde}_a_${parsed.data.hasta}.csv`,
        [
          "Fecha",
          "Tipo",
          "Detalle",
          "Cliente",
          "Forma de pago",
          "Recibo",
          "Neto",
          "IVA",
          "Alícuota %",
          "Total",
        ],
        reporte.operaciones.map((op) => [
          op.fecha,
          op.tipo === "movimiento" ? "Estacionamiento" : "Alquiler",
          op.detalle,
          op.cliente ?? "",
          op.forma_pago ?? "",
          String(op.recibo_numero).padStart(6, "0"),
          op.neto,
          op.iva,
          op.alicuota,
          op.monto_total,
        ]),
      );
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}
