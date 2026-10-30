import { z } from "zod";

const TIPOS_COMPROBANTE = [
  "Factura A",
  "Factura B",
  "Factura C",
  "Presupuesto",
  "Recibo",
  "Ticket",
  "Otro",
] as const;

const FORMAS_PAGO = [
  "efectivo",
  "transferencia",
  "tarjeta",
  "mercadopago",
  "otro",
] as const;

const montoSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Monto inválido (ej: 1234.56)")
  .transform((val) => val);

export const gastoCreateSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)"),
  proveedor: z.string().min(1, "Proveedor obligatorio").max(120),
  cuit_proveedor: z
    .string()
    .max(13)
    .regex(/^(\d{2}-?\d{8}-?\d)?$/, "CUIT inválido (20-12345678-9)")
    .optional()
    .nullable(),
  tipo_comprobante: z.enum(TIPOS_COMPROBANTE).default("Factura C"),
  punto_venta: z.coerce.number().int().min(1).max(9999).optional().nullable(),
  numero_comprobante: z.coerce.number().int().min(1).max(99999999).optional().nullable(),
  neto_gravado: montoSchema.default("0"),
  iva_21: montoSchema.default("0"),
  iva_105: montoSchema.default("0"),
  iva_27: montoSchema.default("0"),
  no_gravado: montoSchema.default("0"),
  percepcion_iva: montoSchema.default("0"),
  percepcion_iibb: montoSchema.default("0"),
  categoria_id: z.coerce.number().int().positive().optional().nullable(),
  forma_pago: z.enum(FORMAS_PAGO).default("otro"),
  notas: z.string().max(255).optional().nullable(),
});

export type GastoCreateInput = z.infer<typeof gastoCreateSchema>;

export const gastoUpdateSchema = gastoCreateSchema.extend({
  id: z.coerce.number().int().positive(),
});

export type GastoUpdateInput = z.infer<typeof gastoUpdateSchema>;

export const gastoQuerySchema = z.object({
  fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categoria_id: z.coerce.number().int().positive().optional(),
  proveedor: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type GastoQueryInput = z.infer<typeof gastoQuerySchema>;

export type GastoActor = {
  usuarioId: number;
  ip?: string | null;
};