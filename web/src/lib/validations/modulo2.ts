import { z } from "zod";
import { normalizarPatente } from "@/lib/format";

export const TIPOS_VEHICULO = [
  "auto",
  "moto",
  "camioneta",
  "discapacidad",
] as const;

export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export const ESTADOS_CLIENTE = ["activo", "inactivo"] as const;
export type EstadoCliente = (typeof ESTADOS_CLIENTE)[number];

// --- Clientes ---

export const clienteCreateSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(100),
  documento: z.string().trim().max(20).optional().nullable(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Email inválido")
    .max(100)
    .optional()
    .or(z.literal(""))
    .nullable(),
  telefono: z.string().trim().max(20).optional().nullable(),
  saldo_actual: z.coerce
    .number()
    .min(0, "El saldo no puede ser negativo")
    .default(0),
  estado: z.enum(ESTADOS_CLIENTE).default("activo"),
});

export const clienteUpdateSchema = clienteCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debe enviar al menos un campo para actualizar" }
);

export const clienteQuerySchema = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  estado: z.enum(["todos", ...ESTADOS_CLIENTE]).default("todos"),
});

export type ClienteCreateInput = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;
export type ClienteQueryInput = z.infer<typeof clienteQuerySchema>;

// --- Vehículos ---

export const vehiculoCreateSchema = z.object({
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
      message: "Patente debe contener sólo letras y números (3 a 10 caracteres)",
    }),
  tipo: z.enum(TIPOS_VEHICULO).default("auto"),
  marca: z.string().trim().max(50).optional().nullable(),
  modelo: z.string().trim().max(50).optional().nullable(),
  color: z.string().trim().max(30).optional().nullable(),
  cliente_id: z.coerce.number().int().positive().optional().nullable(),
});

export const vehiculoUpdateSchema = vehiculoCreateSchema
  .omit({ patente: true })
  .extend({
    patente: z
      .string()
      .trim()
      .min(3)
      .max(10)
      .transform(normalizarPatente)
      .refine((val) => /^[A-Z0-9]{3,10}$/.test(val), {
        message: "Patente debe contener sólo letras y números",
      })
      .optional(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const vehiculoQuerySchema = z.object({
  q: z.string().trim().optional(),
  tipo: z.enum(["todos", ...TIPOS_VEHICULO]).default("todos"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  cliente_id: z.coerce.number().int().positive().optional(),
});

export type VehiculoCreateInput = z.infer<typeof vehiculoCreateSchema>;
export type VehiculoUpdateInput = z.infer<typeof vehiculoUpdateSchema>;
export type VehiculoQueryInput = z.infer<typeof vehiculoQuerySchema>;
