import { describe, it, expect } from "vitest";
import { normalizarPatente, formatMoney, formatMoneySign, formatFecha } from "../src/lib/format";
import {
  clienteCreateSchema,
  vehiculoCreateSchema,
} from "../src/lib/validations/modulo2";

describe("Helpers de formato argentino", () => {
  it("normaliza patentes a mayúsculas sin espacios ni guiones", () => {
    expect(normalizarPatente(" aa 123 - cd ")).toBe("AA123CD");
    expect(normalizarPatente("ab-456_de")).toBe("AB456DE");
    expect(normalizarPatente("ac 789 xy")).toBe("AC789XY");
    expect(normalizarPatente("")).toBe("");
  });

  it("formatea moneda correctamente", () => {
    expect(formatMoney(1234.56)).toBe("1.234,56");
    expect(formatMoneySign(1234.56)).toBe("$ 1.234,56");
    expect(formatMoney(0)).toBe("0,00");
  });

  it("formatea fechas correctamente", () => {
    expect(formatFecha("2026-10-21T15:00:00Z")).toMatch(/\d{2}\/\d{2}\/2026/);
    expect(formatFecha(null)).toBe("-");
  });
});

describe("Validaciones de Clientes", () => {
  it("valida cliente correcto", () => {
    const res = clienteCreateSchema.safeParse({
      nombre: "Carlos Gómez",
      documento: "30123456",
      email: "carlos@test.local",
      telefono: "1122334455",
      saldo_actual: 500,
      estado: "activo",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza cliente con nombre menor a 3 caracteres", () => {
    const res = clienteCreateSchema.safeParse({
      nombre: "Jo",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza saldo negativo", () => {
    const res = clienteCreateSchema.safeParse({
      nombre: "Juan Perez",
      saldo_actual: -10,
    });
    expect(res.success).toBe(false);
  });
});

describe("Validaciones de Vehículos", () => {
  it("valida y normaliza patente de vehículo", () => {
    const res = vehiculoCreateSchema.safeParse({
      patente: " aa-123-cd ",
      tipo: "auto",
      marca: "Ford",
      modelo: "Fiesta",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.patente).toBe("AA123CD");
    }
  });

  it("rechaza tipo de vehículo no admitido", () => {
    const res = vehiculoCreateSchema.safeParse({
      patente: "AA123CD",
      tipo: "camion_pesado",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza patente con caracteres inválidos", () => {
    const res = vehiculoCreateSchema.safeParse({
      patente: "AA$123!",
      tipo: "auto",
    });
    expect(res.success).toBe(false);
  });
});
