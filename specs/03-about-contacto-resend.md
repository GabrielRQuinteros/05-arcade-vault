# SPEC 03 — Página Acerca de y formulario de contacto con Resend

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-15
> **Objective:** Implementar en `/acerca` la página de `references/templates/home-about/about.jsx` con un formulario de contacto que envía el mensaje por correo mediante Resend desde `POST /api/contacto`.

## Why this spec exists

Es la primera feature con backend real del proyecto: una API key secreta, un endpoint público y un servicio externo. El template simula el envío; esta spec define cómo se envía de verdad, qué pasa cuando falla y cómo se protege la key.

Además, `environment.env` (donde está hoy `RESEND_API_KEY`) tiene dos problemas: Next no lo carga (solo lee `.env`, `.env.local`, `.env.development`, `.env.production` y sus variantes `.local`) y no está cubierto por `.gitignore` (`.env*` no lo matchea), así que podría commitearse. Se migra a `.env.local` y se agrega un template versionado `.env.example`.

## Scope

**In:**

- Migrar `environment.env` a `.env.local` (archivo que Next carga automáticamente) y borrar `environment.env`.
- Nueva variable `CONTACT_TO_EMAIL` en `.env.local`: correo dueño de la cuenta de Resend (confirmado por el usuario como destinatario válido).
- Template `.env.example` versionado, con las mismas claves y valores vacíos o de ejemplo.
- Excepción `!.env.example` en `.gitignore` para que `.env*` no lo ignore.
- Dependencia npm `resend` (SDK oficial).
- Dependencia npm `zod`: toda validación de requests se hace con esquemas Zod.
- Dependencia npm `http-status-codes` para nombrar los status HTTP (`StatusCodes.BAD_REQUEST`, …).
- Formato único de respuesta `ServerResponse<T>` (`{ ok, status, data, message }`) con `createServerResponse` en `lib/server-response.ts`.
- Página `/acerca` con las secciones del template en este orden: hero "ACERCA DE ARCADE VAULT" con misión y 3 highlights, divisor de píxeles animado y sección "CONTÁCTANOS" con tips y formulario.
- Textos copiados literalmente del template.
- Animación `.reveal` reutilizando `components/reveal.tsx` (SPEC 02).
- Link "Acerca de" en el nav (escritorio y panel móvil), activo en `/acerca`.
- Route Handler `POST /api/contacto` que valida el cuerpo y envía el correo con Resend.
- Validación en cliente: si algún campo está vacío, el formulario hace shake y no envía request (igual al template).
- Validación en servidor: campos obligatorios, formato de correo y longitudes máximas.
- Honeypot anti-spam: campo oculto `website`; si viene con contenido, se responde éxito sin enviar.
- `replyTo` del correo = correo ingresado por el usuario.
- Correo en texto plano.
- Estado "enviando": botón deshabilitado con texto "ENVIANDO…".
- Estado éxito: terminal VAULT-OS del template.
- Estado error: la misma terminal en variante error, con líneas `[ERR]` y botón "REINTENTAR" que vuelve al formulario conservando lo escrito.
- CSS mínimo para la variante error de la terminal en `app/globals.css`.

**Out of scope (for future specs):**

- Verificar un dominio propio en Resend (hoy `from` es `onboarding@resend.dev`).
- Correo de confirmación al usuario (requiere dominio verificado).
- Rate limiting en `/api/contacto` (necesita un store compartido tipo Redis/KV).
- CAPTCHA.
- Plantilla HTML del correo.
- Guardar los mensajes en base de datos.
- Validación completa en cliente (formato de correo, longitudes, mensajes por campo).
- Adaptar los textos del template.

## Data model

Variables de entorno.

`.env.local` (no versionado, valores reales):

```bash
RESEND_API_KEY=re_...          # movida desde environment.env
CONTACT_TO_EMAIL=...           # correo dueño de la cuenta de Resend
```

`.env.example` (versionado, template):

```bash
# Copiar a .env.local y completar. Nunca commitear .env.local.

# API key de Resend: https://resend.com/api-keys
RESEND_API_KEY=

# Destinatario de los mensajes de contacto.
# Sin dominio verificado en Resend, debe ser el correo dueño de la cuenta.
CONTACT_TO_EMAIL=
```

El valor real de `CONTACT_TO_EMAIL` no se escribe en esta spec porque se versiona. `/spec-impl` lo pide al usuario en el paso 1.

Contrato de `POST /api/contacto`:

```ts
// Request body (JSON)
type ContactRequest = {
  name: string;    // trim, 1..80 caracteres
  email: string;   // trim, 1..254 caracteres, formato z.email()
  message: string; // trim, 1..2000 caracteres
  website?: string; // honeypot; debe venir vacío
};

// Response body (JSON): formato único del servidor (lib/server-response.ts)
interface ServerResponse<T> {
  ok: boolean;
  status: number;        // igual al status HTTP
  data: T | null;
  message: string | null; // en error: código ContactErrorCode
}
type ContactErrorCode = "VALIDATION" | "CONFIG" | "SEND_FAILED";
type ContactResponse = ServerResponse<null>;
```

Los status se escriben con constantes de `http-status-codes` (`StatusCodes.OK`, `StatusCodes.BAD_REQUEST`, …), no con números.

| Caso                                       | Status | Body                                                          | ¿Envía correo? |
| ------------------------------------------ | ------ | ------------------------------------------------------------- | -------------- |
| Datos válidos y Resend responde OK         | 200    | `{ ok: true, status: 200, data: null, message: null }`        | Sí             |
| Honeypot `website` con contenido           | 200    | `{ ok: true, status: 200, data: null, message: null }`        | No             |
| Body no es JSON o falla alguna validación  | 400    | `{ ok: false, status: 400, data: null, message: "VALIDATION" }` | No           |
| Falta `RESEND_API_KEY` o `CONTACT_TO_EMAIL`| 500    | `{ ok: false, status: 500, data: null, message: "CONFIG" }`   | No             |
| Resend devuelve `error`                    | 502    | `{ ok: false, status: 502, data: null, message: "SEND_FAILED" }` | No          |

Correo enviado:

- `from`: `Arcade Vault <onboarding@resend.dev>`
- `to`: `CONTACT_TO_EMAIL`
- `replyTo`: `email` del usuario
- `subject`: `[ARCADE VAULT] Mensaje de <name>`
- `text`: líneas `Nombre: <name>`, `Correo: <email>`, línea en blanco, `<message>`.

Estado del formulario (cliente, `components/contact-form.tsx`):

```ts
type Status = "idle" | "sending" | "sent" | "error";
type ErrorKind = "VALIDATION" | "CONFIG" | "SEND_FAILED" | "NETWORK";
// form: { name, email, message, website }
```

Textos de la terminal de error:

- Línea final para `VALIDATION`: `> DATOS INVÁLIDOS. REVISA EL CORREO Y QUE EL MENSAJE NO SUPERE 2000 CARACTERES.`
- Línea final para el resto: `> NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO MÁS TARDE.`

Rutas tras esta spec:

- `/acerca` — Acerca de (nueva)
- `/api/contacto` — endpoint POST (nuevo)
- Resto sin cambios.

## Implementation plan

1. Crear `.env.local` con `RESEND_API_KEY` (copiada de `environment.env`) y `CONTACT_TO_EMAIL` (valor pedido al usuario), y borrar `environment.env`. Crear `.env.example` con el contenido del modelo de datos y agregar `!.env.example` a `.gitignore` debajo de `.env*`. Verificar con `git status` que aparece `.env.example` y no aparece `.env.local`.
2. Instalar `resend`, `http-status-codes` y `zod` con `npm install resend http-status-codes zod`. Leer en `node_modules/next/dist/docs/01-app/` la guía de Route Handlers antes de escribir el endpoint.
3. Crear `lib/server-response.ts` con `ServerResponse<T>` y `createServerResponse(ok, status, data, message)`. Crear `lib/contact.ts` con los tipos `ContactRequest` y `ContactErrorCode`, los límites (`NAME_MAX = 80`, `EMAIL_MAX = 254`, `MESSAGE_MAX = 2000`) el esquema Zod `contactSchema` (trim, longitudes, `z.email()`, `name` sin saltos de línea), `isHoneypotFilled(body)` (esquema Zod de `website` no vacío) y `validateContact(body)`, que hace `safeParse` y devuelve los datos limpios o `null`.
4. Crear `app/api/contacto/route.ts` con `POST`: parsea JSON, aplica honeypot, valida, chequea env vars y llama a `resend.emails.send` según la tabla del modelo de datos. Toda respuesta se arma con `createServerResponse` y status de `StatusCodes`. Manual: `curl` con body válido devuelve 200 y llega el correo; body vacío devuelve 400.
5. Añadir a `app/globals.css` la variante error de la terminal: `.terminal-success.error` con borde y sombra roja, y `.term-body .line.error` en rojo.
6. Crear `components/contact-form.tsx` (cliente) con los campos del template, el honeypot oculto (fuera de pantalla, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`), shake en vacíos y los estados `idle` / `sending` / `sent` / `error`. El fetch a `/api/contacto` que falla por red se trata como `NETWORK`.
7. Crear `components/about.tsx` (servidor) con hero, `HighlightIcon`, divisor y sección de contacto que monta `<ContactForm />` y `<Reveal />`.
8. Crear `app/acerca/page.tsx`, que renderiza `<About />` y exporta `metadata` con título "Acerca de".
9. Actualizar `components/nav.tsx`: link "Acerca de" a `/acerca` después de "Salón de la Fama", activo si `pathname === "/acerca"`, en escritorio y en el panel móvil.

## Acceptance criteria

- [ ] `environment.env` no existe y `git status` no muestra `.env.local`.
- [ ] `git status` muestra `.env.example` como archivo nuevo; `git check-ignore .env.example` no devuelve nada.
- [ ] `.env.example` contiene `RESEND_API_KEY` y `CONTACT_TO_EMAIL` sin valores reales.
- [ ] `next dev` muestra `.env.local` en la línea "Environments" al arrancar.
- [ ] `npm run build` termina sin errores y genera `/acerca` y `/api/contacto`.
- [ ] `npx tsc --noEmit` y `npx eslint app components lib` no reportan errores.
- [ ] `RESEND_API_KEY` no aparece en ningún archivo de `.next/static/`.
- [ ] `/acerca` muestra "ACERCA DE ARCADE VAULT", los 3 highlights, el divisor y "CONTÁCTANOS".
- [ ] El nav muestra "Acerca de" en escritorio y en el panel móvil; navega a `/acerca` y queda activo solo ahí.
- [ ] Enviar con algún campo vacío hace shake y no genera request a `/api/contacto`.
- [ ] Durante el envío el botón muestra "ENVIANDO…" y está deshabilitado.
- [ ] Un envío válido muestra la terminal con "MENSAJE RECIBIDO… GRACIAS, <NOMBRE>." y el correo llega a `CONTACT_TO_EMAIL`.
- [ ] Responder al correo recibido usa como destinatario el correo ingresado en el formulario.
- [ ] El asunto del correo es `[ARCADE VAULT] Mensaje de <nombre>`.
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] `curl -X POST /api/contacto` con `email: "no-es-correo"` devuelve 400 `{ ok: false, status: 400, data: null, message: "VALIDATION" }`.
- [ ] Toda respuesta de `/api/contacto` tiene las 4 claves `ok`, `status`, `data`, `message`, y `status` coincide con el status HTTP.
- [ ] Un mensaje de 2001 caracteres devuelve 400 y la UI muestra la terminal de error con el texto de `VALIDATION`.
- [ ] Un POST con `website` no vacío devuelve 200 `{ ok: true, status: 200, data: null, message: null }` y no llega correo.
- [ ] Con `RESEND_API_KEY` inválida, la UI muestra la terminal de error; "REINTENTAR" vuelve al formulario con los datos intactos.
- [ ] En ancho 375px no hay scroll horizontal en `/acerca`.
- [ ] La consola del navegador no muestra errores de hidratación en `/acerca`.

## Decisions

- **Yes:** `.env.local` en lugar de `environment.env`. Next lo carga solo y `.gitignore` ya lo cubre.
- **No:** mantener `environment.env` con `dotenv`. Dependencia y carga manual sin beneficio.
- **Yes:** template `.env.example` versionado con excepción en `.gitignore`. Documenta qué variables necesita el proyecto sin exponer valores.
- **No:** `.env` versionado con valores por defecto. Mezcla template y valores reales; riesgo de commitear la key.
- **Yes:** destinatario en `CONTACT_TO_EMAIL`. El usuario confirmó que el correo dueño de la cuenta Resend es válido; la variable permite cambiarlo sin tocar código.
- **No:** escribir el correo destinatario en la spec o en `.env.example`. Ambos se versionan y el correo es dato personal.
- **Yes:** Route Handler `POST /api/contacto`. Decisión del usuario: endpoint explícito y reutilizable.
- **No:** Server Action. Hubiera evitado el endpoint público, pero se prefirió el contrato HTTP explícito.
- **Yes:** SDK `resend`. Oficial, tipado, devuelve `{ data, error }`.
- **No:** `fetch` directo a la API REST. Ahorra una dependencia pero obliga a tipar a mano.
- **Yes:** Zod para validar requests. Decisión del usuario: esquemas declarativos en vez de chequeos a mano.
- **Yes:** `http-status-codes` (`StatusCodes.*`) en vez de números mágicos. Decisión del usuario: se lee qué status es.
- **Yes:** formato único `ServerResponse<T>` `{ ok, status, data, message }`. Decisión del usuario: estructura previsible en todos los endpoints. El código de error va en `message`.
- **Yes:** `from: onboarding@resend.dev`. Es el único remitente válido sin dominio verificado.
- **Yes:** texto plano. No hay que escapar HTML del input y alcanza para un buzón interno.
- **Yes:** `replyTo` con el correo del usuario. Responder desde la bandeja va directo al remitente.
- **Yes:** honeypot que responde éxito falso. Un bot no distingue el descarte de un envío real.
- **Yes:** validación de vacíos en cliente (shake del template) y validación completa en servidor. El servidor es la fuente de verdad; el cliente solo evita requests obvias.
- **No:** correo de confirmación al usuario. Falla sin dominio verificado.
- **No:** rate limiting en memoria. No funciona con varias instancias; uno real va en otra spec.
- **Yes:** terminal de error con "REINTENTAR" que conserva los datos. Reutiliza la estética del éxito y no hace perder el mensaje.
- **Yes:** `/acerca` y `/api/contacto`. Rutas en español, como `/salon` y `/biblioteca`.
- **Yes:** `About` como componente servidor y solo `ContactForm` cliente. Mismo patrón que la Home de SPEC 02.
- **No:** Tailwind. Se mantiene el CSS del template, como en SPEC 01 y 02.

## Risks

| Risk                                                         | Mitigation                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| API key commiteada por error                                  | Paso 1 la mueve a `.env.local` (ignorado) y borra `environment.env`; criterio verifica `git status`. |
| API key expuesta al cliente                                   | Solo se lee en `route.ts`, sin prefijo `NEXT_PUBLIC_`; criterio busca la key en `.next/static/`.     |
| Spam o abuso del endpoint (consume cuota de Resend)           | Honeypot y límites de longitud. Rate limiting real queda para otra spec.                             |
| `CONTACT_TO_EMAIL` distinto al de la cuenta Resend            | Resend devuelve error → 502 `SEND_FAILED` y terminal de error. Documentado en el modelo de datos.    |
| Header injection vía `name` en el asunto                      | `validateContact` rechaza `name` con saltos de línea.                                                 |
| Cambios de Next 16 en Route Handlers con `cacheComponents`    | Paso 2 obliga a leer la guía en `node_modules/next/dist/docs/` antes de escribir el endpoint.        |

## What is **not** in this spec

- Dominio verificado en Resend.
- Correo de confirmación al usuario.
- Rate limiting y CAPTCHA.
- Plantilla HTML del correo.
- Persistencia de mensajes.
- Cambios en los textos del template.

Cada uno, si se hace, va en su propio spec.
