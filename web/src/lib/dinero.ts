/**
 * Conversiones monetarias exactas. PostgreSQL `numeric` se maneja como texto y
 * los cálculos se hacen en centavos enteros; nunca se usa `float` para sumar.
 */

export function pesosTextoACentavos(valor: string): number {
  const texto = valor.trim();
  const coincidencia = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(texto);

  if (!coincidencia) {
    throw new Error(`Monto decimal inválido: ${valor}`);
  }

  const [, signo, enteros, decimales = ""] = coincidencia;
  const centavos = Number(enteros) * 100 + Number(decimales.padEnd(2, "0"));

  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Monto fuera del rango seguro: ${valor}`);
  }

  return signo === "-" ? -centavos : centavos;
}

export function centavosAPesosTexto(centavos: number): string {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Centavos fuera del rango seguro: ${centavos}`);
  }

  const signo = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(centavos);
  const pesos = Math.trunc(absoluto / 100);
  const resto = absoluto % 100;

  return `${signo}${pesos}.${String(resto).padStart(2, "0")}`;
}
