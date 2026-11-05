import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { posicionIva } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";

/**
 * Posición de IVA del período — REFERENCIA INTERNA.
 * El saldo es un valor de referencia para el contador: no genera
 * declaración jurada, liquidación ni archivo oficial.
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
    const reporte = await posicionIva(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const filas: (string | number)[][] = reporte.filas.map((fila) => [
        fila.alicuota,
        fila.iva_ventas,
        fila.iva_compras,
        fila.saldo,
        fila.estado,
      ]);
      filas.push(["Percepciones IVA", "", "", reporte.percepciones_iva, "crédito no discriminable"]);
      filas.push(["SALDO TOTAL", "", "", reporte.saldo_total, reporte.estado_total]);

      return csvResponse(
        `posicion_iva_${parsed.data.desde}_a_${parsed.data.hasta}.csv`,
        ["Concepto", "IVA ventas", "IVA compras", "Saldo", "Estado"],
        filas,
      );
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}
