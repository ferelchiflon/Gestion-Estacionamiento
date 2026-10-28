import { describe, it, expect } from "vitest";
import {
  calcularHorasFacturables,
  calcularMontoEstadia,
} from "../src/lib/calculo-estadia";
import {
  ingresoSchema,
  egresoCobroSchema,
} from "../src/lib/validations/modulo4";

describe("Cálculo de Tarifas y Estadías (Regla PHP)", () => {
  it("minuto 0 o menos de una hora factura 1 hora mínima", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida0m = new Date("2026-10-21T10:00:00Z");
    const salida15m = new Date("2026-10-21T10:15:00Z");

    const res0 = calcularHorasFacturables(entrada, salida0m);
    expect(res0.minutosTotales).toBe(0);
    expect(res0.horasCobrables).toBe(1);

    const res15 = calcularHorasFacturables(entrada, salida15m);
    expect(res15.minutosTotales).toBe(15);
    expect(res15.horasCobrables).toBe(1);
  });

  it("1 hora exacta factura 1 hora", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida60m = new Date("2026-10-21T11:00:00Z");

    const res = calcularHorasFacturables(entrada, salida60m);
    expect(res.minutosTotales).toBe(60);
    expect(res.horasCobrables).toBe(1);
  });

  it("1 hora y 1 minuto redondea hacia arriba a 2 horas (ceil)", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida61m = new Date("2026-10-21T11:01:00Z");

    const res = calcularHorasFacturables(entrada, salida61m);
    expect(res.minutosTotales).toBe(61);
    expect(res.horasCobrables).toBe(2);
  });

  it("estadía de varios días calcula correctamente", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida2Dias = new Date("2026-10-23T12:30:00Z"); // 50 horas y 30 min -> 51 horas

    const res = calcularHorasFacturables(entrada, salida2Dias);
    expect(res.horasCobrables).toBe(51);
  });

  it("calcula montos en centavos sin floats", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida = new Date("2026-10-21T12:05:00Z"); // 3 horas
    const tarifaCentavos = 150050; // $1.500,50

    const calc = calcularMontoEstadia(entrada, salida, tarifaCentavos);
    expect(calc.horasCobrables).toBe(3);
    expect(calc.montoTotalCentavos).toBe(450150); // Exacto
    expect(calc.montoTotalPesos).toBe(4501.5);
  });
});

describe("Validaciones de Movimientos", () => {
  it("valida y normaliza ingreso", () => {
    const res = ingresoSchema.safeParse({
      patente: " aa 123 - bb ",
      plaza_id: 5,
      tipo_vehiculo: "auto",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.patente).toBe("AA123BB");
    }
  });

  it("rechaza ingreso sin plaza", () => {
    const res = ingresoSchema.safeParse({
      patente: "AA123BB",
    });
    expect(res.success).toBe(false);
  });

  it("valida payload de egreso y cobro", () => {
    const res = egresoCobroSchema.safeParse({
      movimiento_id: 10,
      forma_pago: "tarjeta",
      registrar_como_deuda: false,
    });
    expect(res.success).toBe(true);
  });
});
