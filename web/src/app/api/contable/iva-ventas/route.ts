import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ivaVentas } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";
import { generarPdfDesdeHtml } from "@/lib/pdf";

/**
 * Reporte de IVA de ventas — REFERENCIA INTERNA.
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
    const reporte = await ivaVentas(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      return csvResponse(
        `iva_ventas_${parsed.data.desde}_a_${parsed.data.hasta}.csv`,
        [
          "Fecha",
          "Tipo",
          "Detalle",
          "Cliente",
          "Forma de pago",
          "Recibo",
          "Neto",
          "IVA",
          "Alícuota %",
          "Total",
        ],
        reporte.operaciones.map((op) => [
          op.fecha,
          op.tipo === "movimiento" ? "Estacionamiento" : "Alquiler",
          op.detalle,
          op.cliente ?? "",
          op.forma_pago ?? "",
          String(op.recibo_numero).padStart(6, "0"),
          op.neto,
          op.iva,
          op.alicuota,
          op.monto_total,
        ]),
      );
    }

    if (parsed.data.export === "pdf") {
      const { configuracionFiscal } = await import("@/lib/contable");
      const config = await configuracionFiscal(pool);
      const filasHtml = reporte.operaciones.map((op) => `
        <tr>
          <td>${op.fecha}</td>
          <td>${op.tipo === "movimiento" ? "Estacionamiento" : "Alquiler"}</td>
          <td>${op.detalle}</td>
          <td>${op.cliente ?? ""}</td>
          <td>${op.forma_pago ?? ""}</td>
          <td>${String(op.recibo_numero).padStart(6, "0")}</td>
          <td class="num">$ ${op.neto}</td>
          <td class="num">$ ${op.iva}</td>
          <td class="num">${op.alicuota}%</td>
          <td class="num">$ ${op.monto_total}</td>
        </tr>
      `).join("");
      const html = `
        <table><thead><tr>
          <th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Cliente</th><th>Forma pago</th>
          <th>Recibo</th><th class="num">Neto</th><th class="num">IVA</th><th class="num">Alíc %</th><th class="num">Total</th>
        </thead><tbody>${filasHtml}</tbody></table>
        <p class="nota">Total operaciones: ${reporte.totales.operaciones} | Neto: $ ${reporte.totales.neto} | IVA: $ ${reporte.totales.iva} | Total: $ ${reporte.totales.total}</p>
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
          titulo: "IVA Ventas (calculado)",
          periodo: `${reporte.periodo.desde} al ${reporte.periodo.hasta}`,
          contenidoHtml: html,
        },
      );
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="iva_ventas_${parsed.data.desde}_a_${parsed.data.hasta}.pdf"`,
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}
