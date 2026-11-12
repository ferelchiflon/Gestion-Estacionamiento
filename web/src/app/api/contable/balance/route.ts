import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { balance } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";
import { generarPdfDesdeHtml } from "@/lib/pdf";

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

    if (parsed.data.export === "pdf") {
      const { configuracionFiscal } = await import("@/lib/contable");
      const config = await configuracionFiscal(pool);
      const html = `
        <table><thead><tr><th>Concepto</th><th class="num">Importe</th></thead><tbody>
          <tr><td colspan="2"><strong>INGRESOS</strong></td></tr>
          <tr><td>Estacionamiento</td><td class="num">$ ${reporte.ingresos.estacionamiento.total}</td></tr>
          <tr><td>Alquileres</td><td class="num">$ ${reporte.ingresos.alquileres.total}</td></tr>
          <tr><td>Deudas cobradas</td><td class="num">$ ${reporte.ingresos.deudas.total}</td></tr>
          <tr><td><strong>Total ingresos</strong></td><td class="num"><strong>$ ${reporte.ingresos.total}</strong></td></tr>
          <tr><td colspan="2"><strong>GASTOS</strong></td></tr>
          ${reporte.gastos.porCategoria.map((c) => `<tr><td>${c.categoria}</td><td class="num">$ ${c.total}</td></tr>`).join("")}
          <tr><td><strong>Total gastos</strong></td><td class="num"><strong>$ ${reporte.gastos.total}</strong></td></tr>
          <tr><td colspan="2"><strong>CUENTAS POR COBRAR</strong></td></tr>
          <tr><td>Cantidad deudores</td><td>${reporte.cuentasPorCobrar.cantidad}</td></tr>
          <tr><td>Total por cobrar</td><td class="num">$ ${reporte.cuentasPorCobrar.total}</td></tr>
          <tr><td>Vencidas</td><td>${reporte.cuentasPorCobrar.vencidas}</td></tr>
          <tr><td><strong>RESULTADO (ingresos - gastos)</strong></td><td class="num"><strong>$ ${reporte.resultado}</strong></td></tr>
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
          titulo: "Balance del período",
          periodo: `${reporte.periodo.desde} al ${reporte.periodo.hasta}`,
          contenidoHtml: html,
        },
      );
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="balance_${parsed.data.desde}_a_${parsed.data.hasta}.pdf"`,
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}