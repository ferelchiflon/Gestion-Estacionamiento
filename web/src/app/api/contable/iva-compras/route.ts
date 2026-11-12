import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ivaCompras } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";
import { generarPdfDesdeHtml } from "@/lib/pdf";

/**
 * Reporte de IVA de compras — REFERENCIA INTERNA.
 * No es una declaración jurada ni genera archivos oficiales.
 */
export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "contador"], "fiscal.read");

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = contableQuerySchema.safeParse(params);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    const reporte = await ivaCompras(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      return csvResponse(
        `iva_compras_${parsed.data.desde}_a_${parsed.data.hasta}.csv`,
        [
          "Fecha",
          "Proveedor",
          "CUIT",
          "Tipo comprobante",
          "Punto venta",
          "Número",
          "Neto gravado",
          "IVA 21",
          "IVA 10,5",
          "IVA 27",
          "No gravado",
          "Percepción IVA",
          "Percepción IIBB (informativo)",
          "Total",
          "Categoría",
          "Forma de pago",
        ],
        reporte.comprobantes.map((c) => [
          c.fecha,
          c.proveedor,
          c.cuit_proveedor ?? "",
          c.tipo_comprobante,
          c.punto_venta ?? "",
          c.numero_comprobante ?? "",
          c.neto_gravado,
          c.iva_21,
          c.iva_105,
          c.iva_27,
          c.no_gravado,
          c.percepcion_iva,
          c.percepcion_iibb,
          c.total,
          c.categoria ?? "",
          c.forma_pago ?? "",
        ]),
      );
    }

    if (parsed.data.export === "pdf") {
      const { configuracionFiscal } = await import("@/lib/contable");
      const config = await configuracionFiscal(pool);
      const filasHtml = reporte.comprobantes.map((c) => `
        <tr>
          <td>${c.fecha}</td>
          <td>${c.proveedor}</td>
          <td>${c.cuit_proveedor ?? ""}</td>
          <td>${c.tipo_comprobante}</td>
          <td>${c.punto_venta ?? ""}</td>
          <td>${c.numero_comprobante ?? ""}</td>
          <td class="num">$ ${c.neto_gravado}</td>
          <td class="num">$ ${c.iva_21}</td>
          <td class="num">$ ${c.iva_105}</td>
          <td class="num">$ ${c.iva_27}</td>
          <td class="num">$ ${c.no_gravado}</td>
          <td class="num">$ ${c.percepcion_iva}</td>
          <td class="num">$ ${c.percepcion_iibb}</td>
          <td class="num">$ ${c.total}</td>
          <td>${c.categoria ?? ""}</td>
          <td>${c.forma_pago ?? ""}</td>
        </tr>
      `).join("");
      const html = `
        <table><thead><tr>
          <th>Fecha</th><th>Proveedor</th><th>CUIT</th><th>Tipo</th><th>P.V.</th><th>Número</th>
          <th class="num">Neto grav.</th><th class="num">IVA 21</th><th class="num">IVA 10.5</th><th class="num">IVA 27</th>
          <th class="num">No grav.</th><th class="num">Perc. IVA</th><th class="num">Perc. IIBB</th>
          <th class="num">Total</th><th>Categoría</th><th>Forma pago</th>
        </thead><tbody>${filasHtml}</tbody></table>
        <p class="nota">Comprobantes: ${reporte.totales.comprobantes} | Neto gravado: $ ${reporte.totales.neto_gravado} | IVA: $ ${reporte.totales.iva} | Total: $ ${reporte.totales.total}</p>
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
          titulo: "IVA Compras (calculado)",
          periodo: `${reporte.periodo.desde} al ${reporte.periodo.hasta}`,
          contenidoHtml: html,
        },
      );
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="iva_compras_${parsed.data.desde}_a_${parsed.data.hasta}.pdf"`,
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}
