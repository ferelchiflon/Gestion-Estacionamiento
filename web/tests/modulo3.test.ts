import { describe, it, expect } from "vitest";
import {
  plazaCreateSchema,
  plazaUpdateSchema,
  tarifaCreateSchema,
  tarifaUpdateSchema,
} from "../src/lib/validations/modulo3";

describe("Validaciones de Plazas (Módulo 3)", () => {
  it("valida plaza correcta y normaliza mayúsculas", () => {
    const res = plazaCreateSchema.safeParse({
      numero: "05",
      sector: "b",
      tipo_vehiculo: "auto",
      estado: "libre",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.numero).toBe("05");
      expect(res.data.sector).toBe("B");
    }
  });

  it("rechaza plaza sin número", () => {
    const res = plazaCreateSchema.safeParse({
      numero: " ",
      sector: "A",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza estado de plaza inválido", () => {
    const res = plazaCreateSchema.safeParse({
      numero: "10",
      estado: "clausurada",
    });
    expect(res.success).toBe(false);
  });

  it("valida actualización parcial de plaza", () => {
    const res = plazaUpdateSchema.safeParse({
      estado: "ocupada",
    });
    expect(res.success).toBe(true);
  });
});

describe("Validaciones de Tarifas (Módulo 3)", () => {
  it("valida tarifa con rango correcto", () => {
    const res = tarifaCreateSchema.safeParse({
      tipo_vehiculo: "moto",
      tarifa_hora: 800.5,
      fecha_desde: "2026-10-01",
      fecha_hasta: "2026-12-31",
    });
    expect(res.success).toBe(true);
  });

  it("valida tarifa con vigencia abierta (fecha_hasta null/omitida)", () => {
    const res = tarifaCreateSchema.safeParse({
      tipo_vehiculo: "auto",
      tarifa_hora: 1500,
      fecha_desde: "2026-10-01",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza tarifa con fecha_hasta anterior a fecha_desde", () => {
    const res = tarifaCreateSchema.safeParse({
      tipo_vehiculo: "auto",
      tarifa_hora: 1500,
      fecha_desde: "2026-10-15",
      fecha_hasta: "2026-10-10",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza tarifa negativa", () => {
    const res = tarifaCreateSchema.safeParse({
      tipo_vehiculo: "auto",
      tarifa_hora: -50,
      fecha_desde: "2026-10-01",
    });
    expect(res.success).toBe(false);
  });

  it("valida actualización de tarifa", () => {
    const res = tarifaUpdateSchema.safeParse({
      tarifa_hora: 1800,
      fecha_hasta: "2026-11-30",
    });
    expect(res.success).toBe(true);
  });
});
