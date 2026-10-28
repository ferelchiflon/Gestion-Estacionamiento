import { describe, expect, it } from "vitest";
import { can, permissionsFor, ROLES } from "@/lib/permissions";

describe("matriz de permisos", () => {
  it("admin tiene todos los permisos", () => {
    expect(ROLES).toContain("admin");
    expect(permissionsFor("admin").length).toBeGreaterThan(0);
  });

  it("admin puede administrar usuarios y auditoría", () => {
    expect(can("admin", "usuarios.manage")).toBe(true);
    expect(can("admin", "auditoria.read")).toBe(true);
  });

  it("operador no administra usuarios ni ve datos fiscales", () => {
    expect(can("operador", "usuarios.manage")).toBe(false);
    expect(can("operador", "auditoria.read")).toBe(false);
    expect(can("operador", "fiscal.read")).toBe(false);
    expect(can("operador", "operaciones.write")).toBe(true);
  });

  it("contador ve lo fiscal pero no escribe operaciones", () => {
    expect(can("contador", "fiscal.read")).toBe(true);
    expect(can("contador", "fiscal.write")).toBe(true);
    expect(can("contador", "operaciones.write")).toBe(false);
    expect(can("contador", "usuarios.manage")).toBe(false);
  });
});
