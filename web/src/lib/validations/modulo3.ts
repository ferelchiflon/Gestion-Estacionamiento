import { z } from "zod";
import { TIPOS_VEHICULO, type TipoVehiculo } from "./modulo2";

export const ESTADOS_PLAZA = ["libre", "ocupada", "mantenimiento"] as const;
export type EstadoPlaza = (typeof ESTADOS_PLAZA)[number];

// --- Plazas ---

export const plazaCreateSchema = z.object({
  numero: z
    .string()
    .trim()
    .min(1, "El número de plaza es obligatorio")
    .max(10)
    .transform((val) => val.toUpperCase()),
  sector: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .default("A")
    .transform((val) => val.toUpperCase()),
  tipo_vehiculo: z.enum(TIPOS_VEHICULO).default("auto"),
  estado: z.enum(ESTADOS_PLAZA).default("libre"),
});

export const plazaUpdateSchema = plazaCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "Debe enviar al menos un campo para actualizar" }
);

export const plazaQuerySchema = z.object({
  sector: z.string().trim().optional(),
  tipo_vehiculo: z.enum(["todos", ...TIPOS_VEHICULO]).default("todos"),
  estado: z.enum(["todos", ...ESTADOS_PLAZA]).default("todos"),
});

export type PlazaCreateInput = z.infer<typeof plazaCreateSchema>;
export type PlazaUpdateInput = z.infer<typeof plazaUpdateSchema>;
export type PlazaQueryInput = z.infer<typeof plazaQuerySchema>;

// --- Tarifas ---

export const tarifaCreateSchema = z
  .object({
    tipo_vehiculo: z.enum(TIPOS_VEHICULO),
    tarifa_hora: z.coerce
      .number()
      .min(0, "La tarifa no puede ser negativa"),
    fecha_desde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (AAAA-MM-DD)"),
    fecha_hasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (AAAA-MM-DD)")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (!data.fecha_hasta) return true;
      return data.fecha_hasta >= data.fecha_desde;
    },
    {
      message: "La fecha hasta debe ser igual o posterior a la fecha desde",
      path: ["fecha_hasta"],
    }
  );

export const tarifaUpdateSchema = z
  .object({
    tarifa_hora: z.coerce.number().min(0).optional(),
    fecha_desde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (AAAA-MM-DD)")
      .optional(),
    fecha_hasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (AAAA-MM-DD)")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.fecha_desde && data.fecha_hasta) {
        return data.fecha_hasta >= data.fecha_desde;
      }
      return true;
    },
    {
      message: "La fecha hasta debe ser igual o posterior a la fecha desde",
      path: ["fecha_hasta"],
    }
  );

export type TarifaCreateInput = z.infer<typeof tarifaCreateSchema>;
export type TarifaUpdateInput = z.infer<typeof tarifaUpdateSchema>;
export type { TipoVehiculo };
