import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ivaCompras } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";

/**
 * Reporte de IVA de compras — REFERENCIA INTERNA.
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
    const reporte = await ivaCompras(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      return csvResponse(
        `iva_compras_${parsed.data.desde}_a_${parsed.data.hasta}.csv`,
        [
          "Fecha",
          "Proveedor",
          "CUIT",
          "Tipo comprobante",
          "Punto venta",
          "Número",
          "Neto gravado",
          "IVA 21",
          "IVA 10,5",
          "IVA 27",
          "No gravado",
          "Percepción IVA",
          "Percepción IIBB (informativo)",
          "Total",
          "Categoría",
          "Forma de pago",
        ],
        reporte.comprobantes.map((c) => [
          c.fecha,
          c.proveedor,
          c.cuit_proveedor ?? "",
          c.tipo_comprobante,
          c.punto_venta ?? "",
          c.numero_comprobante ?? "",
          c.neto_gravado,
          c.iva_21,
          c.iva_105,
          c.iva_27,
          c.no_gravado,
          c.percepcion_iva,
          c.percepcion_iibb,
          c.total,
          c.categoria ?? "",
          c.forma_pago ?? "",
        ]),
      );
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}
