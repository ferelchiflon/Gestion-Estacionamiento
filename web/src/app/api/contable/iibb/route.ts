import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { iibb } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";
import { pesosTextoACentavos } from "@/lib/dinero";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "contador"], "fiscal.read");

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = contableQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const reporte = await iibb(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const saldoCentavos = pesosTextoACentavos(reporte.saldo);
      const encabezados = ["Concepto", "Importe"];
      const filas: (string | number)[][] = [
        ["Período", reporte.periodo.desde, reporte.periodo.hasta],
        ["Jurisdicción principal", reporte.jurisdiccion],
        ["Ventas brutas (con IVA)", reporte.ventasBrutas],
        ["Base imponible (ventas netas)", reporte.baseImponible],
        ["Alícuota IIBB (%)", reporte.alicuotaIibb],
        ["Impuesto determinado", reporte.impuestoDeterminado],
        ["Percepciones cargadas", reporte.percepciones],
        ["Retenciones cargadas", reporte.retenciones],
        [saldoCentavos >= 0 ? "Saldo a ingresar" : "Saldo a favor", reporte.saldo],
        [],
        ["Jurisdicción", "Percepciones", "Retenciones"],
        ...reporte.porJurisdiccion.map((j) => [j.jurisdiccion, j.percepciones, j.retenciones]),
        [],
        ["Nota: estructura preparada para Convenio Multilateral; hoy funciona con una sola jurisdicción."],
      ];
      return csvResponse(`iibb_${parsed.data.desde}_a_${parsed.data.hasta}.csv`, encabezados, filas);
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}