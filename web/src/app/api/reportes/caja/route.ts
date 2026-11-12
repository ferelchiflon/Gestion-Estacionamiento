import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { reporteCaja } from "@/lib/reportes";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "reportes.read");

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = contableQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const reporte = await reporteCaja(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const encabezados = ["Fecha", "Total", "Efectivo", "Tarjeta", "Transferencia", "Otras", "Operaciones"];
      const filas = reporte.dias.map((d) => [
        d.fecha,
        d.total,
        d.efectivo,
        d.tarjeta,
        d.transferencia,
        d.otras,
        d.operaciones,
      ]);
      filas.push([
        "TOTALES",
        reporte.totales.total,
        reporte.totales.efectivo,
        reporte.totales.tarjeta,
        reporte.totales.transferencia,
        reporte.totales.otras,
        reporte.totales.operaciones,
      ]);
      return csvResponse(`caja_${parsed.data.desde}_a_${parsed.data.hasta}.csv`, encabezados, filas);
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}