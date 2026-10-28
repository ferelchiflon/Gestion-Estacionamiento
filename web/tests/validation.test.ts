import { describe, expect, it } from "vitest";
import {
  loginSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/lib/validation";

describe("validaciones de autenticación", () => {
  it("normaliza el email de login", () => {
    const result = loginSchema.parse({
      email: "  Admin@Estacionamiento.LOCAL ",
      password: "123456",
    });
    expect(result.email).toBe("admin@estacionamiento.local");
  });

  it("rechaza claves de usuario demasiado cortas", () => {
    const result = userCreateSchema.safeParse({
      nombre: "Operador Test",
      email: "operador@test.local",
      password: "corta123",
      rol: "operador",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un update vacío", () => {
    const result = userUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
