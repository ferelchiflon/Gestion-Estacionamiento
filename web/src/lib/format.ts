/**
 * Helper compartido para formateo argentino de dinero, fechas y patentes.
 * Regla: Dinero 1.234,56 / $ 1.234,56; Fechas dd/mm/aaaa en zona America/Argentina/Buenos_Aires.
 */

export const TIMEZONE_AR = "America/Argentina/Buenos_Aires";

/**
 * Convierte un número o string numérico a formato moneda AR: "1.234,56"
 */
export function formatMoney(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "0,00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "0,00";

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Convierte un número o string numérico a formato con signo: "$ 1.234,56"
 */
export function formatMoneySign(val: number | string | null | undefined): string {
  return `$ ${formatMoney(val)}`;
}

/**
 * Formatea fecha ISO o Date a "dd/mm/aaaa" según la zona horaria argentina.
 */
export function formatFecha(val: Date | string | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIMEZONE_AR,
  }).format(d);
}

/**
 * Formatea fecha y hora a "dd/mm/aaaa HH:mm" en zona horaria argentina.
 */
export function formatFechaHora(val: Date | string | null | undefined): string {
  if (!val) return "-";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return String(val);

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE_AR,
  }).format(d);
}

/**
 * Normaliza una patente a mayúsculas, sin espacios ni guiones.
 * Ej: " aa 123 - cd " -> "AA123CD"
 */
export function normalizarPatente(patente: string | null | undefined): string {
  if (!patente) return "";
  return patente.trim().toUpperCase().replace(/[\s\-_]/g, "");
}
