import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { balance } from "@/lib/contable";
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
    const reporte = await balance(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const encabezados = ["Concepto", "Importe"];
      const filas: (string | number)[][] = [
        ["Período", `${reporte.periodo.desde} a ${reporte.periodo.hasta}`],
        ["", ""],
        ["INGRESOS", ""],
        ["Estacionamiento", reporte.ingresos.estacionamiento.total],
        ["Alquileres", reporte.ingresos.alquileres.total],
        ["Deudas cobradas", reporte.ingresos.deudas.total],
        ["Total ingresos", reporte.ingresos.total],
        ["", ""],
        ["GASTOS", ""],
        ...reporte.gastos.porCategoria.map((c) => [c.categoria, c.total]),
        ["Total gastos", reporte.gastos.total],
        ["", ""],
        ["CUENTAS POR COBRAR", ""],
        ["Cantidad", reporte.cuentasPorCobrar.cantidad],
        ["Total", reporte.cuentasPorCobrar.total],
        ["Vencidas", reporte.cuentasPorCobrar.vencidas],
        ["", ""],
        ["RESULTADO (ingresos - gastos)", reporte.resultado],
      ];
      return csvResponse(`balance_${parsed.data.desde}_a_${parsed.data.hasta}.csv`, encabezados, filas);
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}