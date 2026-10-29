import { z } from "zod";

export const deudasQuerySchema = z.object({
  cliente_id: z.coerce.number().int().positive().optional(),
  tipo: z.enum(["movimiento", "alquiler", "todas"]).default("todas"),
  estado: z.enum(["pendiente", "pagada", "todas"]).default("pendiente"),
  antiguedad_min: z.coerce.number().int().min(0).optional(),
  antiguedad_max: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(["monto", "antiguedad", "cliente"]).default("antiguedad"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

export type DeudasQueryInput = z.infer<typeof deudasQuerySchema>;

export const marcarSaldadaSchema = z.object({
  deuda_id: z.coerce.number().int().positive(),
  observacion: z.string().max(500).optional(),
});

export type MarcarSaldadaInput = z.infer<typeof marcarSaldadaSchema>;

export const registrarPagoParcialSchema = z.object({
  deuda_id: z.coerce.number().int().positive(),
  monto: z.string().regex(/^\d+(\.\d{1,2})?$/),
  forma_pago: z.enum(["efectivo", "tarjeta", "transferencia", "saldo_prepago"]),
  observacion: z.string().max(500).optional(),
});

export type RegistrarPagoParcialInput = z.infer<typeof registrarPagoParcialSchema>;

export type DeudaActor = {
  usuarioId: number;
  ip?: string | null;
};