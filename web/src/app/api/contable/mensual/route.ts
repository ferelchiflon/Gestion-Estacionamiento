import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { reporteMensual } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { z } from "zod";

const mensualQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  export: z.enum(["csv"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "contador"], "fiscal.read");

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = mensualQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const reporte = await reporteMensual(pool, parsed.data.mes, parsed.data.anio);

    if (parsed.data.export === "csv") {
      const filas: (string | number)[][] = [
        ["Período", `${reporte.periodo.anio}-${String(reporte.periodo.mes).padStart(2, "0")}`],
        ["", ""],
        ["INGRESOS", ""],
        ["Estacionamiento", reporte.ingresos.estacionamiento],
        ["Alquileres", reporte.ingresos.alquileres],
        ["Deudas cobradas", reporte.ingresos.deudas],
        ["Total ingresos", reporte.ingresos.total],
        ["", ""],
        ["GASTOS", ""],
        ...reporte.gastos.porCategoria.map((c) => [c.categoria, c.total]),
        ["Total gastos", reporte.gastos.total],
        ["", ""],
        ["PLAZAS", ""],
        ["Total", reporte.plazas.total],
        ["Ocupadas (rotación)", reporte.plazas.ocupadasRotacion],
        ["Ocupadas (alquiler)", reporte.plazas.ocupadasAlquiler],
        ["Libres", reporte.plazas.libres],
        ["% Ocupación", reporte.plazas.ocupacionPct + "%"],
        ["", ""],
        ["DEUDAS", ""],
        ["Pendientes", reporte.deudas.pendientes],
        ["Total", reporte.deudas.total],
        ["Vencidas", reporte.deudas.vencidas],
      ];
      return csvResponse(`mensual_${reporte.periodo.anio}_${String(reporte.periodo.mes).padStart(2, "0")}.csv`, ["Concepto", "Importe"], filas);
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}