/**
 * Tests del servicio de email (sin red, nunca se instancia un cliente real):
 *
 * - Sin RESEND_API_KEY + APP_ENV=development → simula el envío y SÍ loguea la
 *   reset URL (contiene el token): permitido sólo en desarrollo local.
 * - Sin RESEND_API_KEY en otro entorno → error de configuración y NUNCA
 *   loguea la URL con token.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  enviarEmailResetPassword,
  enviarReciboPorEmail,
} from "../src/lib/services/email";

const URL_CON_TOKEN =
  "http://localhost:3000/resetear-clave?token=token-secreto-de-test&email=test%40resetflow.local";

describe("email sin RESEND_API_KEY", () => {
  const original = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    APP_ENV: process.env.APP_ENV,
  };

  afterEach(() => {
    vi.restoreAllMocks();
    if (original.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original.RESEND_API_KEY;
    if (original.APP_ENV === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = original.APP_ENV;
  });

  function logsDe(spies: Array<{ mock: { calls: Array<unknown[]> } }>): string {
    return spies
      .flatMap((s) => s.mock.calls)
      .map((c) => c.map(String).join(" "))
      .join("\n");
  }

  it("reset password en development: éxito simulado y SÍ loguea la URL con token", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.APP_ENV = "development";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await enviarEmailResetPassword(
      "usuario@resetflow.local",
      "token-secreto-de-test",
      URL_CON_TOKEN,
    );

    expect(res.success).toBe(true);
    expect(logsDe([logSpy])).toContain(URL_CON_TOKEN);
  });

  it("reset password en production: error de configuración y NO loguea la URL con token", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.APP_ENV = "production";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await enviarEmailResetPassword(
      "usuario@resetflow.local",
      "token-secreto-de-test",
      URL_CON_TOKEN,
    );

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/RESEND_API_KEY/);
    const logged = logsDe([logSpy, errorSpy]);
    expect(logged).not.toContain("token-secreto-de-test");
    expect(logged).not.toContain("Reset URL");
  });

  it("reset password sin APP_ENV definida: también error de configuración", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.APP_ENV;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await enviarEmailResetPassword(
      "usuario@resetflow.local",
      "token-secreto-de-test",
      URL_CON_TOKEN,
    );

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/RESEND_API_KEY/);
  });

  it("recibo: en development simula éxito; en otro entorno devuelve error de configuración", async () => {
    delete process.env.RESEND_API_KEY;
    const pdf = Buffer.from("pdf-falso");
    const base = {
      destinatario: "cliente@resetflow.local",
      asunto: "Recibo",
      html: "<p></p>",
      adjuntoPdf: pdf,
    };

    process.env.APP_ENV = "development";
    const resDev = await enviarReciboPorEmail(base);
    expect(resDev.success).toBe(true);

    process.env.APP_ENV = "production";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const resProd = await enviarReciboPorEmail(base);
    expect(resProd.success).toBe(false);
    expect(resProd.error).toMatch(/RESEND_API_KEY/);
  });
});