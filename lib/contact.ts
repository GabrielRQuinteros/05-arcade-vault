import { z } from "zod";

export type ContactRequest = {
  name: string;
  email: string;
  message: string;
  website?: string;
};

export type ContactData = Pick<ContactRequest, "name" | "email" | "message">;

/** Código de error que `POST /api/contacto` devuelve en `message`. */
export type ContactErrorCode = "VALIDATION" | "CONFIG" | "SEND_FAILED";

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const MESSAGE_MAX = 2000;

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(NAME_MAX)
    // Evita header injection: el nombre va en el asunto.
    .refine((value) => !/[\r\n]/.test(value)),
  email: z.string().trim().min(1).max(EMAIL_MAX).pipe(z.email()),
  message: z.string().trim().min(1).max(MESSAGE_MAX),
});

/** Honeypot: matchea solo si `website` viene con contenido. */
const honeypotSchema = z.object({ website: z.string().trim().min(1) });

export function isHoneypotFilled(body: unknown): boolean {
  return honeypotSchema.safeParse(body).success;
}

/** Devuelve los datos limpios (trim) o `null` si algún campo es inválido. */
export function validateContact(body: unknown): ContactData | null {
  const result = contactSchema.safeParse(body);
  return result.success ? result.data : null;
}
