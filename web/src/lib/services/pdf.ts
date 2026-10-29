import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatMoneySign, formatFechaHora } from "@/lib/format";

export interface ReciboPdfData {
  numero: number;
  fecha_emision: string;
  monto: string;
  forma_pago: string;
  patente: string;
  hora_entrada: string;
  hora_salida: string | null;
  plaza_numero: string | null;
  plaza_sector: string | null;
  cliente_nombre: string | null;
  cliente_documento: string | null;
  vehiculo_tipo: string | null;
  razon_social: string;
  cuit: string | null;
}

/**
 * Genera un PDF del recibo usando pdf-lib.
 * Retorna Uint8Array con el contenido del PDF.
 */
export async function generarReciboPdf(data: ReciboPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  // Colores
  const teal = rgb(0.05, 0.58, 0.56); // teal-700
  const darkGray = rgb(0.17, 0.24, 0.31); // slate-900
  const mediumGray = rgb(0.41, 0.47, 0.54); // slate-500
  const lightGray = rgb(0.86, 0.9, 0.92); // slate-200

  // Función helper para dibujar texto
  const drawText = (text: string, x: number, yPos: number, size = 10, fontType = font, color = darkGray) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: fontType,
      color,
    });
  };

  // === CABECERA ===
  // Fondo teal
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: teal,
  });

  // Logo / Nombre empresa
  drawText(data.razon_social || "ESTACIONAMIENTO CENTRAL", margin, height - 70, 20, fontBold, rgb(1, 1, 1));

  if (data.cuit) {
    const whiteWithOpacity = rgb(1, 1, 1);
    drawText(`CUIT: ${data.cuit}`, margin, height - 92, 9, font, whiteWithOpacity);
  }

  // Etiqueta COMPROBANTE DE PAGO
  const badgeText = "COMPROBANTE DE PAGO";
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, 11) + 16;
  page.drawRectangle({
    x: width - margin - badgeWidth,
    y: height - 95,
    width: badgeWidth,
    height: 24,
    color: rgb(0.04, 0.7, 0.46), // emerald-500
    borderWidth: 0,
  });
  drawText(badgeText, width - margin - badgeWidth + 8, height - 90, 11, fontBold, rgb(1, 1, 1));

  // Número de recibo
  drawText(`RECIBO N° ${String(data.numero).padStart(6, "0")}`, margin, height - 130, 16, fontBold, darkGray);
  drawText(`Emisión: ${formatFechaHora(data.fecha_emision)}`, margin, height - 150, 9, font, mediumGray);

  y = height - 190;

  // === DETALLES DE ESTADÍA ===
  // Línea separadora
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: lightGray,
    dashArray: [4, 4],
  });
  y -= 20;

  const labelX = margin;
  const valueX = width / 2 + 30;
  const lineHeight = 22;

  const drawRow = (label: string, value: string) => {
    drawText(label, labelX, y, 10, font, mediumGray);
    drawText(value, valueX, y, 10, fontBold, darkGray);
    y -= lineHeight;
  };

  drawRow("Dominio / Patente:", data.patente);
  drawRow("Tipo de Vehículo:", (data.vehiculo_tipo || "Auto").charAt(0).toUpperCase() + (data.vehiculo_tipo || "Auto").slice(1));

  if (data.plaza_numero) {
    drawRow("Plaza Asignada:", `Cochera ${data.plaza_numero} (Sector ${data.plaza_sector || "-"})`);
  }

  if (data.cliente_nombre) {
    drawRow("Cliente:", data.cliente_nombre);
    if (data.cliente_documento) {
      drawRow("Documento:", data.cliente_documento);
    }
  } else {
    drawRow("Cliente:", "Consumidor Final");
  }

  drawRow("Ingreso:", formatFechaHora(data.hora_entrada));
  drawRow("Egreso:", formatFechaHora(data.hora_salida));

  // Línea separadora
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: lightGray,
    dashArray: [4, 4],
  });
  y -= 20;

  // === TOTAL Y PAGO ===
  drawRow("Forma de Pago:", (data.forma_pago || "Efectivo").toUpperCase());

  y -= 10;
  // Fondo oscuro para el total
  const whiteWithOpacity2 = rgb(1, 1, 1);
  page.drawRectangle({
    x: margin,
    y: y - 30,
    width: width - 2 * margin,
    height: 50,
    color: darkGray,
  });
  drawText("TOTAL ABONADO", width / 2 - font.widthOfTextAtSize("TOTAL ABONADO", 12) / 2, y - 8, 12, fontBold, whiteWithOpacity2);
  drawText(formatMoneySign(data.monto), width / 2 - fontBold.widthOfTextAtSize(formatMoneySign(data.monto), 24) / 2, y - 36, 24, fontBold, rgb(1, 1, 1));

  y -= 70;

  // Pie de página
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: lightGray,
  });
  y -= 16;
  drawText("Gracias por su visita · Guarde este comprobante", width / 2 - font.widthOfTextAtSize("Gracias por su visita · Guarde este comprobante", 8) / 2, y, 8, font, mediumGray);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}