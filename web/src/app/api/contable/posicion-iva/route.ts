import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { posicionIva } from "@/lib/contable";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError } from "@/lib/http";
import { contableQuerySchema } from "@/lib/validations/contable";
import { generarPdfDesdeHtml } from "@/lib/pdf";

/**
 * Posición de IVA del período — REFERENCIA INTERNA.
 * El saldo es un valor de referencia para el contador: no genera
 * declaración jurada, liquidación ni archivo oficial.
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
    const reporte = await posicionIva(pool, {
      desde: parsed.data.desde,
      hasta: parsed.data.hasta,
    });

    if (parsed.data.export === "csv") {
      const filas: (string | number)[][] = reporte.filas.map((fila) => [
        fila.alicuota,
        fila.iva_ventas,
        fila.iva_compras,
        fila.saldo,
        fila.estado,
      ]);
      filas.push(["Percepciones IVA", "", "", reporte.percepciones_iva, "crédito no discriminable"]);
      filas.push(["SALDO TOTAL", "", "", reporte.saldo_total, reporte.estado_total]);

      return csvResponse(
        `posicion_iva_${parsed.data.desde}_a_${parsed.data.hasta}.csv`,
        ["Concepto", "IVA ventas", "IVA compras", "Saldo", "Estado"],
        filas,
      );
    }

    if (parsed.data.export === "pdf") {
      const { configuracionFiscal } = await import("@/lib/contable");
      const config = await configuracionFiscal(pool);
      const filasHtml = reporte.filas.map((fila) => `
        <tr>
          <td>${fila.alicuota}%</td>
          <td class="num">$ ${fila.iva_ventas}</td>
          <td class="num">$ ${fila.iva_compras}</td>
          <td class="num">$ ${fila.saldo}</td>
          <td>${fila.estado}</td>
        </tr>
      `).join("");
      const html = `
        <table><thead><tr>
          <th>Alícuota</th><th class="num">IVA Ventas</th><th class="num">IVA Compras</th><th class="num">Saldo</th><th>Estado</th>
        </thead><tbody>${filasHtml}</tbody></table>
        <p class="nota">Percepciones IVA: $ ${reporte.percepciones_iva} (crédito no discriminable)</p>
        <p class="nota"><strong>Saldo Total: $ ${reporte.saldo_total} (${reporte.estado_total})</strong></p>
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
          titulo: "Posición de IVA mensual",
          periodo: `${reporte.periodo.desde} al ${reporte.periodo.hasta}`,
          contenidoHtml: html,
        },
      );
      return new Response(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="posicion_iva_${parsed.data.desde}_a_${parsed.data.hasta}.pdf"`,
        },
      });
    }

    return Response.json({ data: reporte });
  } catch (error) {
    return errorResponse(error);
  }
}
