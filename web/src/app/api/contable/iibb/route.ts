import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { iibb } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";
import { pesosTextoACentavos } from "@/lib/dinero";
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

    if (parsed.data.export === "pdf") {
      const { configuracionFiscal } = await import("@/lib/contable");
      const config = await configuracionFiscal(pool);
      const filasHtml = reporte.porJurisdiccion.map((j) => `
        <tr>
          <td>${j.jurisdiccion}</td>
          <td class="num">$ ${j.percepciones}</td>
          <td class="num">$ ${j.retenciones}</td>
        </tr>
      `).join("");
      const html = `
        <table><thead><tr>
          <th>Concepto</th><th>Importe</th>
        </thead><tbody>
          <tr><td>Período</td><td>${reporte.periodo.desde} a ${reporte.periodo.hasta}</td></tr>
          <tr><td>Jurisdicción principal</td><td>${reporte.jurisdiccion}</td></tr>
          <tr><td>Ventas brutas (con IVA)</td><td class="num">$ ${reporte.ventasBrutas}</td></tr>
          <tr><td>Base imponible (ventas netas)</td><td class="num">$ ${reporte.baseImponible}</td></tr>
          <tr><td>Alícuota IIBB (%)</td><td class="num">${reporte.alicuotaIibb}%</td></tr>
          <tr><td>Impuesto determinado</td><td class="num">$ ${reporte.impuestoDeterminado}</td></tr>
          <tr><td>Percepciones cargadas</td><td class="num">$ ${reporte.percepciones}</td></tr>
          <tr><td>Retenciones cargadas</td><td class="num">$ ${reporte.retenciones}</td></tr>
          <tr><td><strong>${reporte.saldo >= 0 ? "Saldo a ingresar" : "Saldo a favor"}</strong></td><td class="num"><strong>$ ${reporte.saldo}</strong></td></tr>
        </tbody></table>
        <table><thead><tr>
          <th>Jurisdicción</th><th class="num">Percepciones</th><th class="num">Retenciones</th>
        </thead><tbody>${reporte.porJurisdiccion.map((j) => `
          <tr><td>${j.jurisdiccion}</td><td class="num">$ ${j.percepciones}</td><td class="num">$ ${j.retenciones}</td></tr>
        `).join("")}</tbody></table>
        <p class="nota">Estructura preparada para Convenio Multilateral; hoy funciona con una sola jurisdicción.</p>
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
          titulo: "Ingresos Brutos (IIBB)",
          periodo: `${reporte.periodo.desde} al ${reporte.periodo.hasta}`,
          contenidoHtml: html,
        },
      );
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="iibb_${parsed.data.desde}_a_${parsed.data.hasta}.pdf"`,
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}