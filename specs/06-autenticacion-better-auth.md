# SPEC 06 — Autenticación real con Better Auth

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 04
> **Date:** 2026-11-18
> **Objective:** Reemplazar la sesión mock de `localStorage["av_user"]` por autenticación real con Better Auth (usuario/correo + contraseña, Google y GitHub) sobre el Postgres de Supabase, con sesión en cookie httpOnly firmada como JWT y caducidad deslizante de 7 días.

## Why this spec exists

Hoy `/auth` (SPEC 01) solo escribe `{ name }` en `localStorage["av_user"]` sin validar nada. La próxima spec (leaderboard y scores en Supabase, pausada) necesita jugadores reales para asociar cada puntuación a un usuario.

Se elige Better Auth en lugar de Supabase Auth por decisión del usuario. Sus tablas viven en la misma BD de Supabase (SPEC 04), así que los scores podrán tener una FK a `user`.

El pedido original hablaba de "mantener la sesión con localStorage + JWT". Guardar el token en localStorage lo expone a XSS. Se acordó: token en cookie httpOnly (firmada como JWT), y localStorage solo como cache de datos de display.

## Scope

**In:**

- Instalar `better-auth`, `pg` y `@types/pg`.
- Tablas de Better Auth (`user`, `session`, `account`, `verification`, `jwks`) en el schema `public` del Postgres de Supabase, con RLS activado y sin policies.
- Registro con usuario + correo + contraseña. Contraseñas hasheadas (scrypt, default de Better Auth).
- Login con un único campo que acepta usuario **o** correo, más contraseña.
- Login y registro con Google y GitHub (botones existentes en `/auth`).
- Username autogenerado para cuentas OAuth. Sin vinculación de cuentas: contraseña, Google y GitHub son cuentas separadas.
- Sesión en cookie httpOnly, `cookieCache` con strategy `jwt`, plugin `jwt` (`/api/auth/token`, `/api/auth/jwks`).
- Caducidad deslizante: 7 días desde el último uso, renovada como máximo una vez por día.
- Fachada `useSession()` en `components/session.tsx` respaldada por Better Auth, con cache de display en `localStorage["av_user"]`.
- Menú desplegable en el nav (usuario, email, CERRAR SESIÓN) y "Cerrar sesión" en el panel móvil.
- `/auth` redirige a `/` si ya hay sesión.
- Errores inline y estado de carga en el formulario.
- JUGAR COMO INVITADO se mantiene (navega a `/` sin sesión).
- Env vars nuevas en `.env.example` y `.env.local` (ya completadas antes de implementar, incluidas las apps OAuth de Google y GitHub).

**Out of scope (for future specs):**

- Verificación de email y recuperación de contraseña (irán con Resend).
- Pantalla para elegir o cambiar el username, página de perfil, avatar.
- Protección de rutas con `proxy.ts` (ninguna ruta exige sesión).
- Guardar puntuaciones, tablas de juegos y leaderboard (spec pausada, va después de esta).
- Cambiar el modal FIN DEL JUEGO o la lógica de `av_scores` del reproductor simulado.
- 2FA, passkeys, magic links, otros proveedores OAuth.
- Borrar cuenta, panel de administración, roles.
- Política de RLS que permita leer `user` desde la Data API de Supabase.

## Data model

### Tablas (schema `public`, generadas por Better Auth)

Se generan con `npx @better-auth/cli generate` (SQL) y se aplican con `mcp__supabase__apply_migration` (nombre `better_auth_init`). Columnas relevantes:

```sql
-- "user": id, name, email (unique), "emailVerified", image, "createdAt", "updatedAt",
--         username (unique, minúsculas), "displayUsername"        -- plugin username
-- "session": id, "userId" → user, token (unique), "expiresAt", "ipAddress", "userAgent", ...
-- "account": id, "userId" → user, "providerId" ('credential'|'google'|'github'),
--            "accountId", password (hash scrypt, solo credential), tokens OAuth, ...
-- "verification": id, identifier, value, "expiresAt", ...
-- "jwks": id, "publicKey", "privateKey", "createdAt"              -- plugin jwt
```

Después del SQL generado, la misma migración agrega:

```sql
alter table public."user" enable row level security;
alter table public.session enable row level security;
alter table public.account enable row level security;
alter table public.verification enable row level security;
alter table public.jwks enable row level security;
-- Sin policies: la Data API (publishable key) no puede leer ni escribir estas tablas.
-- Better Auth conecta con el rol postgres vía DATABASE_URL, que no está sujeto a RLS.
```

Tras la migración se regenera `lib/supabase/database.types.ts` con `mcp__supabase__generate_typescript_types`.

### Env vars (`.env.example`, se agregan al final)

```bash
# Better Auth: https://www.better-auth.com/docs/installation
# Secreto de firma (>= 32 chars). Generar con: npx @better-auth/cli secret
BETTER_AUTH_SECRET=
# URL base de la app (http://localhost:3000 en dev).
BETTER_AUTH_URL=

# Connection string Postgres de Supabase (Dashboard > Connect > Transaction pooler, puerto 6543).
# Contiene la password de la BD. Solo servidor.
DATABASE_URL=

# Google OAuth: https://console.cloud.google.com/apis/credentials
# Redirect URI: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# GitHub OAuth: https://github.com/settings/developers > New OAuth App
# Callback URL: http://localhost:3000/api/auth/callback/github
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

`lib/auth/env.ts` valida estas 7 claves con Zod (mismo patrón que `getSupabaseEnv()`): `getAuthEnv()` lanza `Error("Auth env vars faltantes o inválidas: <claves>")`. Solo se importa desde servidor. Ninguna lleva prefijo `NEXT_PUBLIC_`.

### Configuración del servidor (`lib/auth/auth.ts`)

```ts
export const auth = betterAuth({
  database: new Pool({ connectionString: env.DATABASE_URL }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: {
    google: {
      clientId,
      clientSecret,
      mapProfileToUser: async (p) => ({ username: await ensureUniqueUsername(candidateFromEmail(p.email), isUsernameTaken) }),
    },
    github: {
      clientId,
      clientSecret,
      mapProfileToUser: async (p) => ({ username: await ensureUniqueUsername(candidateFromLogin(p.login), isUsernameTaken) }),
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // renovación deslizante, máx. 1 vez/día
    cookieCache: { enabled: true, maxAge: 60 * 5, strategy: "jwt" },
  },
  account: {
    accountLinking: { enabled: false },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 10,
      usernameValidator: (u) => /^[a-zA-Z0-9_]+$/.test(u),
    }),
    jwt(),
  ],
});
```

Los nombres de opciones se confirman contra la doc de la versión instalada de Better Auth en el paso 2. Si `cookieCache.strategy: "jwt"` no existe en esa versión, se registra en Decisions y se mantiene solo el plugin `jwt`.

### Username de cuentas OAuth (`lib/auth/username.ts`)

```ts
function normalizeUsername(raw: string): string; // minúsculas, quita todo lo que no sea [a-z0-9_], recorta a 10
function candidateFromLogin(login: string): string; // GitHub: normalizeUsername(login)
function candidateFromEmail(email: string): string; // Google: normalizeUsername(parte local del email)
// Si el candidato tiene < 3 chars → "player".
async function ensureUniqueUsername(candidate, isTaken): Promise<string>;
// Si username existe: recorta y agrega sufijo numérico (gabriel → gabriel1 → gabriel2…) sin pasar de 10 chars.
```

### Cliente (`lib/auth/auth-client.ts`)

```ts
export const authClient = createAuthClient({
  plugins: [usernameClient(), jwtClient()],
});
// Sin baseURL: mismo origen.
```

### Validación del formulario (`lib/auth/schemas.ts`)

```ts
const usernameSchema = z
  .string()
  .min(3)
  .max(10)
  .regex(/^[a-zA-Z0-9_]+$/);
const passwordSchema = z.string().min(8).max(128);
export const signInSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});
export const signUpSchema = z.object({
  username: usernameSchema,
  email: z.email(),
  password: passwordSchema,
});
```

Login: si `identifier` contiene `@` → `authClient.signIn.email`; si no → `authClient.signIn.username`.
Registro: `authClient.signUp.email({ email, password, name: username, username })`.
Social: `authClient.signIn.social({ provider, callbackURL: "/", errorCallbackURL: "/auth?error=oauth" })`.

### Fachada de sesión (`components/session.tsx`)

```ts
export type User = { name: string; email: string } | null; // name = username en MAYÚSCULAS

const Ctx = createContext<{
  user: User;
  isPending: boolean;
  signOut: () => Promise<void>; // authClient.signOut + borra av_user + router.refresh()
}>(...);
```

- Fuente de verdad: `authClient.useSession()`.
- `localStorage["av_user"]` guarda solo `{ "name": "GABRIEL", "email": "g@x.com" }`. Nunca tokens ni ids.
- Mientras `isPending`, `user` = valor cacheado (evita parpadeo del nav). Al resolver: con sesión → escribe cache; sin sesión → borra cache y `user = null`.
- Se elimina `signIn` de la fachada (el login lo hace `authClient` directamente).

### Mensajes de error (inline, magenta, bajo el formulario)

| Caso                                     | Mensaje                                 |
| ---------------------------------------- | --------------------------------------- |
| Credenciales inválidas (usuario o email) | `USUARIO O CONTRASEÑA INCORRECTOS`      |
| Username ya usado                        | `ESE USUARIO YA EXISTE`                 |
| Email ya registrado                      | `ESE CORREO YA TIENE CUENTA`            |
| `/auth?error=oauth`                      | `NO SE PUDO CONECTAR CON EL PROVEEDOR`  |
| Rate limit (50)                          | `DEMASIADOS INTENTOS. ESPERA UN MINUTO` |
| Cualquier otro error / red               | `ERROR DE CONEXIÓN. INTÉNTALO DE NUEVO` |

Errores de Zod se muestran por campo, debajo de cada input. Mientras la petición está en curso, el botón principal y los sociales se deshabilitan y el principal muestra `CONECTANDO...`.

### Archivos tras esta spec

- `package.json` (modificado: `better-auth`, `pg`, `@types/pg`)
- `.env.example` (modificado)
- `lib/auth/env.ts` (nuevo)
- `lib/auth/auth.ts` (nuevo, solo servidor)
- `lib/auth/username.ts` (nuevo)
- `lib/auth/schemas.ts` (nuevo)
- `lib/auth/auth-client.ts` (nuevo)
- `app/api/auth/[...all]/route.ts` (nuevo, `toNextJsHandler(auth)`)
- `lib/supabase/database.types.ts` (regenerado)
- `app/auth/page.tsx` (modificado: Server Component que redirige si hay sesión y renderiza el form)
- `components/auth-form.tsx` (nuevo, cliente: el formulario actual con lógica real)
- `components/session.tsx` (modificado: fachada)
- `components/user-menu.tsx` (nuevo, cliente: menú desplegable)
- `components/nav.tsx` (modificado)
- `app/globals.css` (modificado: estilos del menú y de errores)

Rutas tras esta spec:

- `/api/auth/*` — nueva (handler de Better Auth, incluye `/api/auth/token` y `/api/auth/jwks`).
- `/auth` — redirige a `/` con sesión activa.
- Resto sin cambios.

## UI

**Nav (escritorio), con sesión:** el botón `.auth-btn` con `{user.name} ▾` abre un menú desplegable anclado debajo:

```
┌────────────────────────┐
│ GABRIEL                │  ← usuario (MAYÚSCULAS)
│ g@x.com                │  ← email, --ink-faint, solo lectura
├────────────────────────┤
│ ▸ CERRAR SESIÓN        │  ← magenta
└────────────────────────┘
```

- Se abre/cierra con clic en el botón; se cierra con clic fuera, con `Esc` y al navegar.
- Accesible: botón con `aria-haspopup="menu"` y `aria-expanded`; ítem con `role="menuitem"`; foco al primer ítem al abrir con teclado.
- Estética del vault: ver "Coherencia visual" abajo.
- Mientras `isPending` sin cache: el botón muestra `···` deshabilitado (no "Iniciar Sesión").

**Panel móvil, con sesión:** el link "Cuenta" se reemplaza por el usuario (texto, no link) y un botón "Cerrar sesión". Sin sesión: "Iniciar Sesión" → `/auth`, como hoy.

**`/auth`:** misma tarjeta y estilos. Cambios:

- Pestaña INICIAR SESIÓN: label `Usuario o correo`, placeholder `px_kai o jugador@vault.gg`.
- Pestaña CREAR CUENTA: `Usuario`, `Correo electrónico`, `Contraseña` (como hoy).
- GOOGLE y GITHUB llaman a `signIn.social`.
- JUGAR COMO INVITADO: `router.push("/")` sin tocar la sesión.
- Login/registro OK: `router.push("/")` + `router.refresh()`.

### Coherencia visual (obligatorio para todo cambio de UI de esta spec)

Los elementos nuevos (menú del usuario, ítems de sesión del panel móvil, errores y estado de carga de `/auth`) deben verse como parte de la app actual, no como componentes agregados.

**Skills de diseño en la implementación:**

- Antes de escribir UI, cargar `/frontend-design` (obligatorio por `CLAUDE.md`). Usarlo para extender la estética existente, no para proponer una nueva.
- Usar `ui-ux-pro-max` para revisar accesibilidad e interacción del menú (foco, teclado, contraste, área táctil). Sus sugerencias de estilo (paletas, fuentes) **no** se aplican si contradicen el sistema actual.

**Reglas concretas, tomadas de `app/globals.css`:**

- Colores solo con las variables existentes: `--bg-2`/`--bg-3` (fondos), `--line`/`--line-2` (bordes y separadores), `--ink`/`--ink-dim`/`--ink-faint` (texto), `--cyan` (acento/foco), `--magenta` (CERRAR SESIÓN y errores). Sin hex nuevos en el CSS agregado.
- Tipografía solo con `--pixel` (títulos, botones, ítems del menú, mensajes de error) y `--mono` (email, textos secundarios). Sin fuentes nuevas.
- Panel del menú con el lenguaje de `.av-mobile-panel`: fondo `--bg-2`, borde `1px solid var(--line)`, separador `1px dashed var(--line-2)`.
- Esquinas con el mismo `clip-path` recortado de `.btn` (sin `border-radius` redondeado).
- Glow de hover/foco como `.btn` / `.btn.magenta` (`box-shadow` con el color del acento). El ítem CERRAR SESIÓN usa el glow magenta de `.btn.magenta:hover`.
- Animación de apertura con los keyframes existentes (`fadeIn`), sin keyframes nuevos. Respetar `prefers-reduced-motion`.
- `z-index` del menú por encima del nav y por debajo del panel móvil (`< 55`).
- En móvil, "Cerrar sesión" del panel lateral usa el mismo estilo que los links de `.av-mobile-panel a`, con texto magenta.
- Errores de `/auth`: `--pixel`, tamaño de los labels actuales, color `--magenta`, prefijo `▸`, como el resto de mensajes de estado de la app (ej. `.toast-saved`).
- Botón en `CONECTANDO...`: mismo `.btn`, con `disabled` y opacidad reducida; sin spinners de librerías.
- Sin librerías de UI ni de iconos nuevas. Los glifos siguen siendo caracteres (`▾`, `▸`, `◆`, `▣`).
- Clases nuevas con el prefijo y la convención actuales (ej. `.user-menu`, `.user-menu-item`) agregadas en `app/globals.css`, junto a los estilos de `.av-nav`.

## Implementation plan

1. Instalar `better-auth`, `pg` y `@types/pg`. Verificar que `git status` no muestra `.env.local`. (Ya hecho antes de implementar: `.env.example` tiene el bloque del modelo de datos y `.env.local` tiene las 7 claves con valor, incluidas las credenciales OAuth de Google y GitHub.)
2. Leer las skills `supabase` y `supabase-postgres-best-practices`, la doc de Better Auth (instalación Next.js, plugins `username` y `jwt`, `session.cookieCache`, `accountLinking`, `databaseHooks`) y en `node_modules/next/dist/docs/01-app/02-guides/` `authentication.md` y `authentication-with-cache-components.md`.
3. Crear `lib/auth/env.ts`, `lib/auth/username.ts` y `lib/auth/auth.ts` (con Google/GitHub configurados aunque las credenciales estén vacías en dev → ver Risks). Crear `app/api/auth/[...all]/route.ts`. `npx tsc --noEmit` pasa.
4. Generar el SQL con `npx @better-auth/cli generate`, agregarle los `enable row level security` y aplicarlo con `mcp__supabase__apply_migration` (`better_auth_init`). Verificar con `list_tables` que existen las 5 tablas con RLS activo. Correr `get_advisors` (security) y confirmar que no hay alertas nuevas de RLS. Regenerar `lib/supabase/database.types.ts`.
5. Crear `lib/auth/auth-client.ts` y `lib/auth/schemas.ts`. Reescribir `components/session.tsx` como fachada (sin `signIn`). Ajustar `app/auth/page.tsx` para que compile sin el mock. Manual: la app carga, el nav muestra "Iniciar Sesión", reproductor y salón muestran INVITADO / sin fila "tu mejor marca".
6. Cargar `/frontend-design` y releer "Coherencia visual". Mover el formulario a `components/auth-form.tsx` con login (usuario o correo), registro, validación Zod por campo, errores inline de la tabla, estado `CONECTANDO...` e invitado. `app/auth/page.tsx` pasa a Server Component: lee la sesión con `auth.api.getSession({ headers: await headers() })` (dentro de `Suspense` si `cacheComponents` lo exige, según la guía) y hace `redirect("/")` si existe. Manual: registrar, cerrar pestaña, volver: sigue logueado.
7. Crear `components/user-menu.tsx` siguiendo "Coherencia visual" (con `/frontend-design` y revisión de accesibilidad con `ui-ux-pro-max`) y cablear `components/nav.tsx` (escritorio y panel móvil). Estilos en `app/globals.css`. Comparar con capturas del nav actual (antes/después, escritorio y 375px) para confirmar que el resto del nav no cambió. Manual: abrir/cerrar con clic, clic fuera y Esc; CERRAR SESIÓN deja el nav en "Iniciar Sesión".
8. Conectar GOOGLE y GITHUB a `signIn.social` y mostrar el error de `/auth?error=oauth`. Manual: login con GitHub y con Google crea usuario con username autogenerado.
9. Correr `npx tsc --noEmit`, `npx eslint app components lib games`, `npx prettier --check app components lib` y `npm run build`.

## Acceptance criteria

- [ ] `.env.example` contiene `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` sin valores; ninguna con prefijo `NEXT_PUBLIC_`.
- [ ] `git status` no muestra `.env.local`.
- [ ] En Supabase existen `user`, `session`, `account`, `verification` y `jwks` en `public`, todas con RLS activo y sin policies.
- [ ] Un `select` a `user` con la publishable key vía Data API devuelve 0 filas o error de permisos, aunque existan usuarios.
- [ ] Registrar `px_kai` / `kai@test.com` / `12345678` crea una fila en `user` (username `px_kai`) y una en `account` con `providerId = 'credential'` cuyo `password` no es `12345678` (es un hash).
- [ ] Tras registrarse, el usuario queda logueado y el nav muestra `PX_KAI ▾`.
- [ ] Se puede iniciar sesión con `px_kai` y también con `kai@test.com` usando la misma contraseña.
- [ ] Contraseña incorrecta muestra `USUARIO O CONTRASEÑA INCORRECTOS` y no crea sesión.
- [ ] Registrar un username existente muestra `ESE USUARIO YA EXISTE`; un email existente, `ESE CORREO YA TIENE CUENTA`.
- [ ] Usuario de 2 chars, con `-` o de 11 chars, email inválido o contraseña de 7 chars muestran error bajo el campo y no llaman al servidor.
- [ ] Durante la petición el botón muestra `CONECTANDO...` y los botones del form están deshabilitados.
- [ ] La cookie de sesión de Better Auth es `HttpOnly` y su expiración es ~7 días desde el login.
- [ ] `localStorage["av_user"]` contiene solo `name` y `email`; ningún valor de localStorage contiene el token de sesión ni un JWT.
- [ ] Recargar la página o cerrar y reabrir el navegador mantiene la sesión; el nav no muestra "Iniciar Sesión" en ningún frame si había cache.
- [ ] Con sesión, `GET /api/auth/token` devuelve un JWT y `GET /api/auth/jwks` devuelve al menos una clave pública; sin sesión, `/api/auth/token` responde 401.
- [ ] En `session`, tras usar la app al día siguiente del login, `expiresAt` avanzó (renovación deslizante). Verificable forzando `updatedAt`/`expiresAt` en la BD.
- [ ] Clic en el nombre del nav abre el menú con usuario, email y CERRAR SESIÓN; clic fuera y `Esc` lo cierran.
- [ ] El CSS agregado en `app/globals.css` no contiene colores hex ni `rgb()` nuevos; solo `var(--…)` existentes (salvo `rgba` de glow idénticos a los de `.btn.magenta:hover`).
- [ ] El menú y los errores usan solo las fuentes `--pixel` y `--mono`; no se agregó ninguna fuente, librería de UI ni de iconos.
- [ ] El panel del menú usa fondo `--bg-2`, borde `--line` y esquinas con el `clip-path` de `.btn`; ningún elemento nuevo tiene `border-radius` redondeado.
- [ ] Con sesión cerrada, el nav (escritorio y 375px) se ve igual que antes de esta spec, comparado con captura previa.
- [ ] El menú es operable con teclado: Enter/Espacio lo abre, Tab llega a CERRAR SESIÓN, Esc lo cierra y devuelve el foco al botón.
- [ ] CERRAR SESIÓN borra la fila de `session`, borra `localStorage["av_user"]` y el nav vuelve a "Iniciar Sesión".
- [ ] En ancho 375px, el panel móvil muestra el usuario y "Cerrar sesión" con sesión, e "Iniciar Sesión" sin ella; sin scroll horizontal.
- [ ] Con sesión activa, abrir `/auth` redirige a `/`.
- [ ] JUGAR COMO INVITADO lleva a `/` sin crear sesión; el reproductor muestra `INVITADO`.
- [ ] Con sesión, `/juegos/asteroids/jugar` muestra el username en MAYÚSCULAS como Jugador.
- [ ] Login con GitHub crea un usuario con username = login de GitHub normalizado (≤10 chars, `[a-z0-9_]`).
- [ ] Login con Google crea un usuario con username = parte local del email normalizada; si ya existe, recibe sufijo numérico.
- [ ] Entrar con Google/GitHub usando el email de una cuenta ya existente (de otro método) no crea `user` ni `account`; vuelve a `/auth` con `NO SE PUDO CONECTAR CON EL PROVEEDOR`.
- [ ] Cancelar el consentimiento OAuth vuelve a `/auth` con `NO SE PUDO CONECTAR CON EL PROVEEDOR`.
- [ ] `grep -rn "signIn(" components app` no encuentra usos de la fachada mock; `components/session.tsx` no exporta `signIn`.
- [ ] `npx tsc --noEmit`, `npx eslint app components lib games` y `npm run build` terminan sin errores.
- [ ] Ningún archivo de cliente importa `lib/auth/auth.ts` ni `lib/auth/env.ts`.

## Decisions

- **Yes:** Better Auth. Decisión del usuario.
- **No:** Supabase Auth. Descartado por el usuario aunque ya hay cliente Supabase.
- **Yes:** tablas de Better Auth en `public` del Postgres de Supabase vía `pg` + `DATABASE_URL`. Decisión del usuario: una sola BD, permite FK desde `scores` en la próxima spec.
- **No:** schema separado ni SQLite. Separado agrega config; SQLite no sirve en serverless.
- **Yes:** RLS activo sin policies en las 5 tablas. Las tablas en `public` quedarían expuestas por la Data API con la publishable key; Better Auth usa el rol `postgres` y no se ve afectado.
- **Yes:** la app ahora lee la password de la BD (dentro de `DATABASE_URL`). Revisa la decisión de SPEC 04 ("la app no la lee"): Better Auth necesita conexión directa. Solo servidor, sin `NEXT_PUBLIC_`.
- **Yes:** migración aplicada con `apply_migration` del MCP, SQL generado por `@better-auth/cli generate`. Consistente con SPEC 04 (sin Supabase CLI).
- **No:** `@better-auth/cli migrate` directo contra la BD. No queda registrado en `list_migrations`.
- **Yes:** sesión en cookie httpOnly + `cookieCache` strategy `jwt` + plugin `jwt`. Decisión del usuario: cumple "usar JWT" sin exponer el token a XSS.
- **No:** JWT en localStorage (plugin bearer). Pedido original, descartado por riesgo XSS.
- **Yes:** `localStorage["av_user"]` como cache de display (`name`, `email`). Decisión del usuario: cumple "mantener el usuario con info del local storage" y evita parpadeo del nav.
- **Yes:** caducidad deslizante 7 días, `updateAge` 1 día. Decisión del usuario.
- **No:** caducidad absoluta.
- **Yes:** hash scrypt (default de Better Auth). "Contraseñas cifradas" se cumple con hash irreversible, que es lo correcto; no se cifran de forma reversible.
- **Yes:** login con usuario o correo en un único campo (plugin `username`). Decisión del usuario.
- **Yes:** usuario 3–10 chars `[a-zA-Z0-9_]`, guardado en minúsculas, mostrado en MAYÚSCULAS; contraseña 8–128. Decisión del usuario; 10 chars encaja con nav y HUD actuales.
- **No:** reglas de contraseña fuerte (mayúscula, número, símbolo).
- **Yes:** username OAuth autogenerado (GitHub login / parte local del email de Google) con sufijo numérico si existe. Decisión del usuario.
- **No:** pantalla "elige tu usuario" ni usar el nombre del perfil.
- **No:** vinculación de cuentas (`accountLinking.enabled: false`). Better Auth 1.7 exige `emailVerified` local para vincular y la verificación está fuera de scope. Decisión del usuario: cada método es una cuenta separada; un email ya usado por otro método da error OAuth.
- **Yes:** username OAuth único resuelto en `mapProfileToUser` (no en `databaseHooks`). El hook del plugin `username` corre antes que los del usuario y rechazaría el duplicado.
- **Yes:** verificación de email y reset de contraseña fuera de scope. Decisión del usuario.
- **Yes:** fachada `useSession()` en `components/session.tsx`. Decisión del usuario: nav, salón y reproductor casi no cambian.
- **No:** usar `authClient.useSession()` directo en cada componente.
- **Yes:** se quita `signIn` de la fachada. El login real lo hace `authClient`; dejarlo invitaría a usar el mock.
- **Yes:** menú desplegable con usuario, email y CERRAR SESIÓN. Decisión del usuario.
- **Yes:** toda UI nueva reutiliza variables, fuentes, `clip-path`, glow y keyframes de `app/globals.css`. Decisión del usuario: frontend coherente con la estética actual.
- **Yes:** `/frontend-design` para diseñar y `ui-ux-pro-max` solo para revisar accesibilidad/interacción. Decisión del usuario; ninguna skill puede imponer paleta o tipografía nuevas.
- **No:** librerías de componentes (Radix, Headless UI) para el menú. Un menú de un ítem no las justifica y traerían estilos/patrones ajenos.
- **No:** link a "Mi perfil". Página nueva; otra spec.
- **Yes:** `/auth` redirige a `/` con sesión, chequeado en servidor. Decisión del usuario.
- **No:** proteger rutas con `proxy.ts`. Decisión del usuario: ninguna ruta exige sesión.
- **Yes:** JUGAR COMO INVITADO se mantiene. Decisión del usuario.
- **Yes:** errores inline en magenta + `CONECTANDO...`. Decisión del usuario.
- **No:** componente toast.
- **Yes:** mismo mensaje para usuario inexistente y contraseña incorrecta. Evita enumerar usuarios.
- **Yes:** apps OAuth de Google y GitHub creadas por el usuario y credenciales cargadas en `.env.local` antes de implementar. Better Auth corre dentro de la app (`/api/auth/*`); no hay servidor de auth aparte.
- **Yes:** `/auth` dividido en Server Component (redirect) + `components/auth-form.tsx` (cliente). El redirect necesita leer cookies en servidor.

## Risks

| Risk                                                                     | Mitigation                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Tablas de auth (hashes, tokens OAuth) expuestas por la Data API          | RLS activo sin policies en la misma migración; criterio prueba un `select` con la publishable key; `get_advisors` en paso 4. |
| `DATABASE_URL` o `BETTER_AUTH_SECRET` filtrados al cliente               | Sin `NEXT_PUBLIC_`; `env.ts`/`auth.ts` solo servidor; criterio verifica que ningún archivo cliente los importa.              |
| Conexiones agotadas en serverless con `pg`                               | `DATABASE_URL` apunta al transaction pooler (puerto 6543) de Supabase.                                                       |
| API de Better Auth distinta a la del spec (`cookieCache.strategy`, etc.) | Paso 2 lee la doc de la versión instalada; cualquier diferencia se anota en Decisions.                                       |
| `cacheComponents` exige `Suspense` al leer `headers()` en `/auth`        | Paso 2 lee `authentication-with-cache-components.md`; paso 6 sigue el patrón de la guía.                                     |
| Parpadeo / mismatch de hidratación del nav al leer localStorage          | Se mantiene `useSyncExternalStore` con snapshot de servidor `null`, como hoy; estado `···` mientras `isPending` sin cache.   |
| Cache `av_user` desactualizado (sesión vencida en otro dispositivo)      | Al resolver `useSession()` sin sesión se borra el cache y `user = null`.                                                     |
| Colisión de usernames autogenerados en carrera                           | `username` es `unique` en BD; si el insert falla, el login OAuth da error y el usuario reintenta (caso improbable).          |

## What is **not** in this spec

- Verificación de email y recuperación de contraseña.
- Elegir/cambiar username, perfil, avatar.
- Protección de rutas con `proxy.ts`.
- Guardado de puntuaciones, tablas de juegos y leaderboard.
- Cambios en el modal FIN DEL JUEGO o en `av_scores`.
- 2FA, passkeys, magic links, otros proveedores.
- Borrar cuenta, roles, admin.

Cada uno, si se hace, va en su propio spec.
