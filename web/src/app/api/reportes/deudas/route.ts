import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { reporteDeudas } from "@/lib/reportes";
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
    const reporte = await reporteDeudas(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const encabezados = [
        "ID",
        "Cliente",
        "Documento",
        "Email",
        "Teléfono",
        "Tipo",
        "Referencia",
        "Monto original",
        "Monto con interés",
        "Vencimiento",
        "Días atraso",
        "Estado",
      ];
      const filas = reporte.filas.map((f) => [
        f.id,
        f.cliente_nombre,
        f.cliente_documento ?? "—",
        f.cliente_email ?? "—",
        f.cliente_telefono ?? "—",
        f.tipo,
        f.referencia,
        f.monto_original,
        f.monto_con_interes,
        f.fecha_vencimiento,
        f.dias_atraso,
        f.estado,
      ]);
      filas.push([
        "TOTALES",
        "",
        "",
        "",
        "",
        "",
        "",
        reporte.totales.monto_original,
        reporte.totales.monto_con_interes,
        "",
        "",
        `Vencidas: ${reporte.totales.vencidas}`,
      ]);
      return csvResponse(`deudas_${parsed.data.desde}_a_${parsed.data.hasta}.csv`, encabezados, filas);
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}