import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3, "MÍNIMO 3 CARACTERES")
  .max(10, "MÁXIMO 10 CARACTERES")
  .regex(/^[a-zA-Z0-9_]+$/, "SOLO LETRAS, NÚMEROS Y _");

const passwordSchema = z
  .string()
  .min(8, "MÍNIMO 8 CARACTERES")
  .max(128, "MÁXIMO 128 CARACTERES");

export const signInSchema = z.object({
  identifier: z.string().min(1, "CAMPO OBLIGATORIO"),
  password: z.string().min(1, "CAMPO OBLIGATORIO"),
});

export const signUpSchema = z.object({
  username: usernameSchema,
  email: z.email("CORREO INVÁLIDO"),
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
