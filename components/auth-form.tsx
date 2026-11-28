"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { authClient } from "@/lib/auth/auth-client";
import { signInSchema, signUpSchema } from "@/lib/auth/schemas";

type Tab = "in" | "up";
type Field = "identifier" | "username" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

const MSG = {
  credentials: "USUARIO O CONTRASEÑA INCORRECTOS",
  usernameTaken: "ESE USUARIO YA EXISTE",
  emailTaken: "ESE CORREO YA TIENE CUENTA",
  oauth: "NO SE PUDO CONECTAR CON EL PROVEEDOR",
  rateLimit: "DEMASIADOS INTENTOS. ESPERA UN MINUTO",
  network: "ERROR DE CONEXIÓN. INTÉNTALO DE NUEVO",
  passwordCompromised: "CONTRASEÑA FILTRADA EN BRECHAS. ELIGE OTRA.",
} as const;

type AuthError = { code?: string; status?: number } | null | undefined;

function messageFor(error: AuthError): string {
  if (error?.status === 429) return MSG.rateLimit;
  switch (error?.code) {
    case "INVALID_USERNAME_OR_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return MSG.credentials;
    case "USERNAME_IS_ALREADY_TAKEN":
      return MSG.usernameTaken;
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return MSG.emailTaken;
    default:
      return MSG.network;
  }
}

function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as Field;
    out[key] ??= issue.message;
  }
  return out;
}

export function AuthForm() {
  const router = useRouter();
  // Better Auth vuelve a errorCallbackURL con su propio `error`; cualquier valor cuenta.
  const oauthFailed = useSearchParams().has("error");

  const [tab, setTab] = useState<Tab>("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(
    oauthFailed ? MSG.oauth : null,
  );

  const switchTab = (next: Tab) => {
    setTab(next);
    setFieldErrors({});
    setFormError(null);
  };

  const done = () => {
    router.push("/");
    router.refresh();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (tab === "in") {
      const parsed = signInSchema.safeParse({
        identifier: user.trim(),
        password: pass,
      });
      if (!parsed.success) return setFieldErrors(fieldErrorsOf(parsed.error));
      setFieldErrors({});
      setBusy(true);
      try {
        const { identifier, password } = parsed.data;
        const { error } = identifier.includes("@")
          ? await authClient.signIn.email({ email: identifier, password })
          : await authClient.signIn.username({
              username: identifier,
              password,
            });
        if (error) throw error;
        done();
      } catch (err) {
        setFormError(messageFor(err as AuthError));
        setBusy(false);
      }
      return;
    }

    const parsed = signUpSchema.safeParse({
      username: user.trim(),
      email: email.trim(),
      password: pass,
    });
    if (!parsed.success) return setFieldErrors(fieldErrorsOf(parsed.error));
    setFieldErrors({});
    setBusy(true);
    try {
      const { username, email: mail, password } = parsed.data;
      const { error } = await authClient.signUp.email({
        email: mail,
        password,
        name: username,
        username,
      });
      if (error) throw error;
      done();
    } catch (err) {
      const authError = err as AuthError;
      // Contraseña filtrada (plugin haveIBeenPwned): error del campo, no del formulario.
      if (authError?.code === "PASSWORD_COMPROMISED") {
        setFieldErrors({ password: MSG.passwordCompromised });
      } else {
        setFormError(messageFor(authError));
      }
      setBusy(false);
    }
  };

  const social = async (provider: "google" | "github") => {
    setFormError(null);
    setBusy(true);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: "/",
        errorCallbackURL: "/auth?error=oauth",
      });
      if (error) throw error;
      // Éxito: el navegador sale hacia el proveedor; el botón queda deshabilitado.
    } catch {
      setFormError(MSG.oauth);
      setBusy(false);
    }
  };

  const userField: Field = tab === "in" ? "identifier" : "username";
  const errorId = (f: Field) => `${f}-error`;
  const fieldProps = (f: Field) =>
    fieldErrors[f]
      ? { "aria-invalid": true, "aria-describedby": errorId(f) }
      : {};
  const fieldError = (f: Field) =>
    fieldErrors[f] && (
      <p id={errorId(f)} className="field-error">
        ▸ {fieldErrors[f]}
      </p>
    );

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
            disabled={busy}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
            disabled={busy}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="usuario">
              {tab === "in" ? "Usuario o correo" : "Usuario"}
            </label>
            <input
              id="usuario"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder={
                tab === "in" ? "px_kai o jugador@vault.gg" : "px_kai"
              }
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              {...fieldProps(userField)}
            />
            {fieldError(userField)}
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="correo">Correo electrónico</label>
              <input
                id="correo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                {...fieldProps("email")}
              />
              {fieldError("email")}
            </div>
          )}
          <div className="field">
            <label htmlFor="clave">Contraseña</label>
            <input
              id="clave"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
              {...fieldProps("password")}
            />
            {fieldError("password")}
          </div>

          <button
            className="btn lg"
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
            disabled={busy}
          >
            {busy
              ? "CONECTANDO..."
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>

          {formError && (
            <p className="auth-error" role="alert">
              ▸ {formError}
            </p>
          )}
        </form>

        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          disabled={busy}
          onClick={() => router.push("/")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => social("google")}
          >
            ◆&nbsp; GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={() => social("github")}
          >
            ▣&nbsp; GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
