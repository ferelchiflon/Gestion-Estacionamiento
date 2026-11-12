import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { reporteMensual } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { z } from "zod";
import { generarPdfDesdeHtml } from "@/lib/pdf";

const mensualQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  anio: z.coerce.number().int().min(2000).max(2100),
  export: z.enum(["csv", "pdf"]).optional(),
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

    if (parsed.data.export === "pdf") {
      const { configuracionFiscal } = await import("@/lib/contable");
      const config = await configuracionFiscal(pool);
      const html = `
        <table><thead><tr><th>Concepto</th><th class="num">Importe</th></thead><tbody>
          <tr><td colspan="2"><strong>INGRESOS</strong></td></tr>
          <tr><td>Estacionamiento</td><td class="num">$ ${reporte.ingresos.estacionamiento}</td></tr>
          <tr><td>Alquileres</td><td class="num">$ ${reporte.ingresos.alquileres}</td></tr>
          <tr><td>Deudas cobradas</td><td class="num">$ ${reporte.ingresos.deudas}</td></tr>
          <tr><td><strong>Total ingresos</strong></td><td class="num"><strong>$ ${reporte.ingresos.total}</strong></td></tr>
          <tr><td colspan="2"><strong>GASTOS</strong></td></tr>
          ${reporte.gastos.porCategoria.map((c) => `<tr><td>${c.categoria}</td><td class="num">$ ${c.total}</td></tr>`).join("")}
          <tr><td><strong>Total gastos</strong></td><td class="num"><strong>$ ${reporte.gastos.total}</strong></td></tr>
          <tr><td colspan="2"><strong>PLAZAS Y OCUPACIÓN</strong></td></tr>
          <tr><td>Total plazas</td><td>${reporte.plazas.total}</td></tr>
          <tr><td>Ocupadas (rotación)</td><td>${reporte.plazas.ocupadasRotacion}</td></tr>
          <tr><td>Ocupadas (alquiler)</td><td>${reporte.plazas.ocupadasAlquiler}</td></tr>
          <tr><td>Libres</td><td>${reporte.plazas.libres}</td></tr>
          <tr><td>% Ocupación</td><td>${reporte.plazas.ocupacionPct}%</td></tr>
          <tr><td colspan="2"><strong>DEUDAS</strong></td></tr>
          <tr><td>Pendientes</td><td>${reporte.deudas.pendientes}</td></tr>
          <tr><td>Total</td><td class="num">$ ${reporte.deudas.total}</td></tr>
          <tr><td>Vencidas</td><td>${reporte.deudas.vencidas}</td></tr>
        </tbody></table>
        <p class="nota">${reporte.advertencias.join("<br>")}</p>
      `;
      const pdfBytes = await generarPdfDesdeHtml(
        {
          razonSocial: config.razon_social,
          cuit: config.cuit,
          condicionIva: config.condicion_iva,
          direccion: config.direccion,
          telefono: config.telefono,
        },
        {
          titulo: "Reporte mensual",
          periodo: `${reporte.periodo.anio}-${String(reporte.periodo.mes).padStart(2, "0")}`,
          contenidoHtml: html,
        },
      );
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="mensual_${reporte.periodo.anio}_${String(reporte.periodo.mes).padStart(2, "0")}.pdf"`,
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}