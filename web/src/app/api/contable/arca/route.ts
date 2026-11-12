import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { arca, ADVERTENCIA_REFERENCIA } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "contador"], "fiscal.read");

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = contableQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const reporte = await arca(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const encabezadosResumen = ["Concepto", "Importe"];
      const filasResumen = [
        ["Período", `${reporte.periodo.desde} a ${reporte.periodo.hasta}`],
        ["Punto de venta", reporte.puntoVenta],
      ];

      const encabezadosDias = ["Fecha", "Comprobantes", "Neto", "IVA", "Total"];
      const filasDias = reporte.dias.map((d) => [d.fecha, d.comprobantes, d.neto, d.iva, d.total]);
      filasDias.push(["TOTALES", reporte.totales.comprobantes, reporte.totales.neto, reporte.totales.iva, reporte.totales.total]);

      const encabezadosForma = ["Forma de pago", "Operaciones", "Total"];
      const filasForma = reporte.porFormaPago.map((f) => [f.forma_pago, f.operaciones, f.total]);

      const csv = [
        encabezadosResumen.join(";"),
        ...filasResumen.map((f) => f.join(";")),
        "",
        encabezadosDias.join(";"),
        ...filasDias.map((f) => f.join(";")),
        "",
        encabezadosForma.join(";"),
        ...filasForma.map((f) => f.join(";")),
        "",
        ["Nota: el sistema no emite comprobantes electrónicos; se listan recibos internos como \"Recibo C\"."],
        ["Neto e IVA calculados sobre precio final usando la alícuota general de configuracion_fiscal."],
        ["Formato del Libro IVA Digital (RG 3685/4647): mejora futura."],
        [ADVERTENCIA_REFERENCIA],
      ].join("\r\n");

      return new Response(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="arca_${parsed.data.desde}_a_${parsed.data.hasta}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}