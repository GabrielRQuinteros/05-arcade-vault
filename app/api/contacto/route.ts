import { StatusCodes } from "http-status-codes";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isHoneypotFilled, validateContact, type ContactErrorCode } from "@/lib/contact";
import { createServerResponse } from "@/lib/server-response";

function success() {
  return NextResponse.json(createServerResponse<null>(true, StatusCodes.OK, null, null), {
    status: StatusCodes.OK,
  });
}

function failure(status: StatusCodes, code: ContactErrorCode) {
  return NextResponse.json(createServerResponse<null>(false, status, null, code), { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(StatusCodes.BAD_REQUEST, "VALIDATION");
  }

  // Honeypot: un bot rellenó el campo oculto → éxito falso, sin enviar.
  if (isHoneypotFilled(body)) {
    return success();
  }

  const data = validateContact(body);
  if (!data) {
    return failure(StatusCodes.BAD_REQUEST, "VALIDATION");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    console.error("[api/contacto] Falta RESEND_API_KEY o CONTACT_TO_EMAIL");
    return failure(StatusCodes.INTERNAL_SERVER_ERROR, "CONFIG");
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: "Arcade Vault <onboarding@resend.dev>",
    to,
    replyTo: data.email,
    subject: `[ARCADE VAULT] Mensaje de ${data.name}`,
    text: `Nombre: ${data.name}\nCorreo: ${data.email}\n\n${data.message}`,
  });

  if (error) {
    console.error("[api/contacto] Resend error:", error.name, error.message);
    return failure(StatusCodes.BAD_GATEWAY, "SEND_FAILED");
  }

  return success();
}
