/**
 * Generación de PDF usando pdf-lib.
 *
 * Patrón: HTML renderizado en el servidor + @media print (igual que recibos y el PdfExporter PHP).
 * El cliente llama a window.print() para guardar como PDF.
 */
import { PDFDocument, rgb, StandardFonts, Page } from "pdf-lib";

export type PdfConfig = {
  razonSocial: string;
  cuit: string;
  condicionIva: string;
  direccion: string;
  telefono: string;
};

export type PdfReporte = {
  titulo: string;
  periodo: string;
  contenidoHtml: string; // HTML del cuerpo (tablas, totales)
};

type PdfFont = Awaited<ReturnType<typeof PDFDocument.prototype.embedFont>>;

/**
 * Genera un PDF a partir de HTML usando pdf-lib.
 * Nota: pdf-lib no renderiza HTML directamente. Esta función crea un PDF
 * estructurado (encabezado, tablas parseadas, pie de página) basado en
 * los datos del reporte. Para HTML complejo, usar @media print en el cliente.
 */
export async function generarPdfDesdeHtml(
  config: PdfConfig,
  reporte: PdfReporte,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  // Encabezado empresa
  page.drawText(config.razonSocial, { x: margin, y, size: 16, font: fontBold, color: rgb(0, 0, 0) });
  y -= 20;
  page.drawText(`CUIT: ${config.cuit}  ·  Condición: ${config.condicionIva}`, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  if (config.direccion) {
    y -= 14;
    page.drawText(config.direccion, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  }
  if (config.telefono) {
    y -= 14;
    page.drawText(`Tel: ${config.telefono}`, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.5, 0.5, 0.5) });
  y -= 10;

  // Título reporte
  page.drawText(reporte.titulo, { x: margin, y, size: 14, font: fontBold, color: rgb(0, 0, 0) });
  y -= 16;
  page.drawText(`Período: ${reporte.periodo}`, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  y -= 20;

  // Parsear HTML simple (tablas) - versión básica
  // Para producción completa, usar @media print en cliente
  const lineas = reporte.contenidoHtml
    .replace(/<[^>]*>/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const linea of lineas) {
    if (y < margin + 20) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - margin;
    }
    page.drawText(linea.slice(0, 100), { x: margin, y, size: 8, font, color: rgb(0, 0, 0) });
    y -= 12;
  }

  // Pie de página
  page.drawLine({ start: { x: margin, y: margin - 10 }, end: { x: width - margin, y: margin - 10 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  page.drawText(`${config.razonSocial} - CUIT ${config.cuit}`, { x: margin, y: margin - 24, size: 7, font, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(`Emitido: ${new Date().toLocaleString("es-AR")}`, { x: width - margin - 120, y: margin - 24, size: 7, font, color: rgb(0.5, 0.5, 0.5) });

  return pdf.save();
}

/**
 * Helper: crear tabla en PDF a partir de encabezados y filas (array de arrays).
 */
export async function agregarTablaAPdf(
  pdf: PDFDocument,
  page: Page,
  x: number,
  y: number,
  encabezados: string[],
  filas: (string | number)[][],
  font: PdfFont,
  fontBold: PdfFont,
): Promise<number> {
  const colWidths = encabezados.map((h) => Math.max(h.length * 6, 60));
  const rowHeight = 18;

  // Encabezados
  let cx = x;
  for (let i = 0; i < encabezados.length; i++) {
    page.drawRectangle({ x: cx, y: y - rowHeight, width: colWidths[i], height: rowHeight, color: rgb(0.9, 0.9, 0.9) });
    page.drawText(encabezados[i], { x: cx + 4, y: y - 12, size: 8, font: fontBold });
    cx += colWidths[i];
  }

  let cy = y - rowHeight;
  for (const fila of filas) {
    if (cy < 60) {
      // nueva página
      page = pdf.addPage([595.28, 841.89]);
      cy = page.getSize().height - 60;
    }
    cx = x;
    for (let i = 0; i < fila.length; i++) {
      page.drawRectangle({ x: cx, y: cy - rowHeight, width: colWidths[i], height: rowHeight, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
      page.drawText(String(fila[i]).slice(0, 30), { x: cx + 4, y: cy - 12, size: 8, font });
      cx += colWidths[i];
    }
    cy -= rowHeight;
  }

  return cy;
}