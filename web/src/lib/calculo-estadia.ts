/**
 * Reglas de cálculo de estadía y tarifas de estacionamiento.
 * Replicación exacta de la lógica de PHP:
 *   - $horas = max(1, (int)ceil(($interval->days * 24) + $interval->h + ($interval->i / 60)))
 *   - Fracción de hora cuenta como hora completa (ceil).
 *   - Mínimo de cobro: 1 hora.
 *   - Monto total = horas * tarifa_hora_centavos (calculado en centavos enteros para evitar float).
 */

export type CalculoEstadia = {
  minutosTotales: number;
  horasCobrables: number;
  tarifaHoraCentavos: number;
  montoTotalCentavos: number;
  montoTotalPesos: number;
};

/**
 * Calcula las horas facturables entre dos fechas.
 * Regla: Mínimo 1 hora; cualquier minuto fraccionario redondea hacia arriba (ceil).
 */
export function calcularHorasFacturables(
  fechaEntrada: Date | string,
  fechaSalida: Date | string
): { minutosTotales: number; horasCobrables: number } {
  const dEntrada = typeof fechaEntrada === "string" ? new Date(fechaEntrada) : fechaEntrada;
  const dSalida = typeof fechaSalida === "string" ? new Date(fechaSalida) : fechaSalida;

  const diffMs = Math.max(0, dSalida.getTime() - dEntrada.getTime());
  const minutosTotales = Math.floor(diffMs / (1000 * 60));

  // Cálculo idéntico a PHP: ceil(minutos / 60), mínimo 1 hora
  const horasFraccion = minutosTotales / 60;
  const horasCobrables = Math.max(1, Math.ceil(horasFraccion));

  return {
    minutosTotales,
    horasCobrables,
  };
}

/**
 * Calcula el importe exacto en centavos y en pesos.
 */
export function calcularMontoEstadia(
  fechaEntrada: Date | string,
  fechaSalida: Date | string,
  tarifaHoraCentavos: number
): CalculoEstadia {
  const { minutosTotales, horasCobrables } = calcularHorasFacturables(
    fechaEntrada,
    fechaSalida
  );

  const montoTotalCentavos = horasCobrables * tarifaHoraCentavos;
  const montoTotalPesos = montoTotalCentavos / 100;

  return {
    minutosTotales,
    horasCobrables,
    tarifaHoraCentavos,
    montoTotalCentavos,
    montoTotalPesos,
  };
}
