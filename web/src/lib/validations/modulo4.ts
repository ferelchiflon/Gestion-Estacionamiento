import { z } from "zod";
import { normalizarPatente } from "@/lib/format";
import { TIPOS_VEHICULO } from "./modulo2";

export const FORMAS_PAGO = [
  "efectivo",
  "tarjeta",
  "saldo_prepago",
  "transferencia",
] as const;

export type FormaPago = (typeof FORMAS_PAGO)[number];

export const ESTADOS_PAGO = ["pendiente", "pagado", "deuda"] as const;
export type EstadoPago = (typeof ESTADOS_PAGO)[number];

export const ingresoSchema = z.object({
  patente: z
    .string()
    .trim()
    .transform(normalizarPatente)
    .refine((val) => val.length >= 3, {
      message: "La patente debe tener al menos 3 caracteres",
    })
    .refine((val) => val.length <= 10, {
      message: "La patente no puede exceder 10 caracteres",
    })
    .refine((val) => /^[A-Z0-9]{3,10}$/.test(val), {
      message: "Patente debe contener sólo letras y números",
    }),
  plaza_id: z.coerce.number().int().positive("La plaza es requerida"),
  tipo_vehiculo: z.enum(TIPOS_VEHICULO).default("auto"),
  // Si no está registrado el vehículo, puede venir cliente_id o crearse sobre la marcha
  cliente_id: z.coerce.number().int().positive().optional().nullable(),
  marca: z.string().trim().max(50).optional().nullable(),
  modelo: z.string().trim().max(50).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
});

export const egresoCobroSchema = z.object({
  movimiento_id: z.coerce
    .number()
    .int()
    .positive("ID de movimiento inválido"),
  forma_pago: z.enum(FORMAS_PAGO).default("efectivo"),
  registrar_como_deuda: z.boolean().default(false),
});

export const movimientosQuerySchema = z.object({
  q: z.string().trim().optional(),
  activos_only: z.coerce.boolean().default(false),
  fecha_desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
    .optional(),
  fecha_hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato AAAA-MM-DD")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type IngresoInput = z.infer<typeof ingresoSchema>;
export type EgresoCobroInput = z.infer<typeof egresoCobroSchema>;
export type MovimientosQueryInput = z.infer<typeof movimientosQuerySchema>;
