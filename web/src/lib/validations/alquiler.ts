import { z } from "zod";

export const crearContratoSchema = z.object({
  plaza_id: z.coerce.number().int().positive(),
  cliente_id: z.coerce.number().int().positive(),
  tipo_alquiler_id: z.coerce.number().int().positive(),
  monto_total: z.string().regex(/^\d+(\.\d{1,2})?$/), // numeric string
  dia_vencimiento: z.coerce.number().int().min(1).max(28).nullable(),
});

export const registrarPagoSchema = z.object({
  contrato_id: z.coerce.number().int().positive(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  monto: z.string().regex(/^\d+(\.\d{1,2})?$/),
  forma_pago: z.enum(["efectivo", "tarjeta", "transferencia", "saldo_prepago"]),
});

export type AlquilerActor = {
  usuarioId: number;
  ip?: string | null;
};

export type CrearContratoInput = z.infer<typeof crearContratoSchema>;
export type RegistrarPagoInput = z.infer<typeof registrarPagoSchema>;
