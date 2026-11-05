/**
 * Helper de exportación CSV.
 *
 * Los reportes exportados son de REFERENCIA INTERNA (sujetos a aprobación del
 * contador), no archivos oficiales. El separador es ";" y el archivo se emite
 * con BOM UTF-8 para que Excel respete acentos y la coma decimal.
 */

const SEPARADOR = ";";

function escapar(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  if (texto.includes(SEPARADOR) || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * Arma un CSV a partir de encabezados y filas.
 * `encabezados` es un array de strings; `filas` un array de arrays de valores.
 */
export function armarCsv(
  encabezados: string[],
  filas: (string | number | null | undefined)[][],
): string {
  const lineas = [
    encabezados.map(escapar).join(SEPARADOR),
    ...filas.map((fila) => fila.map(escapar).join(SEPARADOR)),
  ];
  return lineas.join("\r\n");
}

/** Respuesta HTTP con el CSV como archivo adjunto. */
export function csvResponse(
  nombreArchivo: string,
  encabezados: string[],
  filas: (string | number | null | undefined)[][],
): Response {
  const csv = armarCsv(encabezados, filas);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
