import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { reporteOcupacion } from "@/lib/reportes";
import { csvResponse } from "@/lib/csv";
import { errorResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "reportes.read");

    const pool = getPool();
    const reporte = await reporteOcupacion(pool);

    const exportParam = request.nextUrl.searchParams.get("export");

    if (exportParam === "csv") {
      const encabezadosResumen = [
        "Concepto",
        "Valor",
      ];
      const filasResumen = [
        ["Fecha", reporte.fecha],
        ["Total plazas", reporte.resumen.total_plazas],
        ["Ocupadas (rotación)", reporte.resumen.ocupadas_rotacion],
        ["Ocupadas (alquiler)", reporte.resumen.ocupadas_alquiler],
        ["Libres", reporte.resumen.libres],
        ["% Ocupación", `${reporte.resumen.porcentaje_ocupacion}%`],
      ];

      const encabezadosSector = ["Sector", "Total", "Ocupadas", "Libres", "% Ocupación"];
      const filasSector = reporte.por_sector.map((s) => [
        s.sector,
        s.total,
        s.ocupadas,
        s.libres,
        `${s.porcentaje}%`,
      ]);

      const encabezadosContratos = ["Plaza", "Sector", "Cliente", "Fecha fin"];
      const filasContratos = reporte.contratos_activos.map((c) => [
        c.plaza_numero,
        c.sector,
        c.cliente_nombre,
        c.fecha_fin ?? "Indefinido",
      ]);

      const csv = [
        encabezadosResumen.join(";"),
        ...filasResumen.map((f) => f.join(";")),
        "",
        encabezadosSector.join(";"),
        ...filasSector.map((f) => f.join(";")),
        "",
        encabezadosContratos.join(";"),
        ...filasContratos.map((f) => f.join(";")),
      ].join("\r\n");

      return new Response(`\uFEFF${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ocupacion_${reporte.fecha}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}