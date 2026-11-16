"use client";

import { useId, useState, type FormEvent } from "react";
import type { ContactErrorCode } from "@/lib/contact";
import type { ServerResponse } from "@/lib/server-response";

type Status = "idle" | "sending" | "sent" | "error";
type ErrorKind = ContactErrorCode | "NETWORK";
type Form = { name: string; email: string; message: string; website: string };

const EMPTY_FORM: Form = { name: "", email: "", message: "", website: "" };
const ERROR_CODES: readonly ContactErrorCode[] = ["VALIDATION", "CONFIG", "SEND_FAILED"];

const ERROR_TEXT = {
  VALIDATION: "> DATOS INVÁLIDOS. REVISA EL CORREO Y QUE EL MENSAJE NO SUPERE 2000 CARACTERES.",
  OTHER: "> NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO MÁS TARDE.",
};

function toErrorKind(message: string | null): ContactErrorCode {
  return ERROR_CODES.find((code) => code === message) ?? "SEND_FAILED";
}

export function ContactForm() {
  const id = useId();
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKind, setErrorKind] = useState<ErrorKind>("SEND_FAILED");
  const [sentName, setSentName] = useState("");
  const [shake, setShake] = useState(false);

  const update = (key: keyof Form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    setStatus("sending");
    let res: ServerResponse<null>;
    try {
      const response = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      res = (await response.json()) as ServerResponse<null>;
    } catch {
      setErrorKind("NETWORK");
      setStatus("error");
      return;
    }

    if (res.ok) {
      setSentName(form.name.trim());
      setStatus("sent");
    } else {
      setErrorKind(toErrorKind(res.message));
      setStatus("error");
    }
  };

  const sending = status === "sending";
  const failed = status === "error";

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      {status === "idle" || sending ? (
        <>
          <div className="field">
            <label htmlFor={`${id}-name`}>NOMBRE</label>
            <input id={`${id}-name`} value={form.name} onChange={update("name")} placeholder="px_kai" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-email`}>CORREO ELECTRÓNICO</label>
            <input
              id={`${id}-email`}
              type="email"
              value={form.email}
              onChange={update("email")}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-message`}>MENSAJE</label>
            <textarea
              id={`${id}-message`}
              rows={5}
              value={form.message}
              onChange={update("message")}
              placeholder="Cuéntanos qué tienes en mente…"
            />
          </div>
          {/* Honeypot: invisible para personas; un bot que lo rellene se descarta en el servidor. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label htmlFor={`${id}-website`}>WEBSITE</label>
            <input
              id={`${id}-website`}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={update("website")}
            />
          </div>
          <button className="btn xl press" type="submit" disabled={sending} style={{ width: "100%" }}>
            {sending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div className={"terminal-success" + (failed ? " error" : "")} role="status">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            {failed ? (
              errorKind === "VALIDATION" ? (
                <>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line error">[ERR] Validando contenido…</div>
                  <div className="line success error">{ERROR_TEXT.VALIDATION}<span className="caret">_</span></div>
                </>
              ) : (
                <>
                  <div className="line dim">[OK] Conectando con servidor…</div>
                  <div className="line dim">[OK] Validando contenido…</div>
                  <div className="line error">[ERR] Transmitiendo paquete…</div>
                  <div className="line success error">{ERROR_TEXT.OTHER}<span className="caret">_</span></div>
                </>
              )
            ) : (
              <>
                <div className="line dim">[OK] Conectando con servidor…</div>
                <div className="line dim">[OK] Validando contenido…</div>
                <div className="line dim">[OK] Transmitiendo paquete…</div>
                <div className="line success">
                  &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sentName.toUpperCase()}.
                  <span className="caret">_</span>
                </div>
              </>
            )}
            <div style={{ marginTop: 18 }}>
              {failed ? (
                <button className="btn ghost" type="button" onClick={() => setStatus("idle")}>
                  REINTENTAR
                </button>
              ) : (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setStatus("idle");
                  }}
                >
                  ENVIAR OTRO MENSAJE
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
