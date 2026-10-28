import { z } from "zod";
import { ROLES } from "@/lib/permissions";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(150),
  password: z.string().min(1).max(72),
});

const passwordSchema = z
  .string()
  .min(10)
  .max(72)
  .regex(/[A-Za-z]/, "La clave debe tener letras")
  .regex(/[0-9]/, "La clave debe tener números");

export const userCreateSchema = z.object({
  nombre: z.string().trim().min(3).max(100),
  email: z.string().trim().toLowerCase().email().max(150),
  password: passwordSchema,
  rol: z.enum(ROLES),
});

export const userIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2_147_483_647);

export const userUpdateSchema = z
  .object({
    nombre: z.string().trim().min(3).max(100).optional(),
    email: z.string().trim().toLowerCase().email().max(150).optional(),
    password: passwordSchema.optional(),
    rol: z.enum(ROLES).optional(),
    activo: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe enviar al menos un campo",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
