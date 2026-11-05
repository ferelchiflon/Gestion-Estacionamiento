import { z } from "zod";

/**
 * Validaciones del módulo contable de REFERENCIA INTERNA.
 *
 * Los reportes no son declaraciones juradas: solo herramientas de apoyo para
 * el contador. El período siempre es un rango cerrado de fechas (YYYY-MM-DD).
 */

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

export const rangoPeriodoSchema = z
  .object({
    desde: fechaSchema,
    hasta: fechaSchema,
  })
  .refine((rango) => rango.hasta >= rango.desde, {
    message: "La fecha hasta debe ser igual o posterior a la fecha desde",
    path: ["hasta"],
  });

export type RangoPeriodoInput = z.infer<typeof rangoPeriodoSchema>;

/** Query string de los endpoints GET del módulo contable. */
export const contableQuerySchema = z
  .object({
    desde: fechaSchema,
    hasta: fechaSchema,
    export: z.enum(["csv"]).optional(),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: "La fecha hasta debe ser igual o posterior a la fecha desde",
    path: ["hasta"],
  });

export type ContableQueryInput = z.infer<typeof contableQuerySchema>;
