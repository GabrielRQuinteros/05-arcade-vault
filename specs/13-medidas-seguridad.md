# SPEC 13 — Medidas de seguridad básicas (auth, RLS y headers)

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 06, SPEC 07
> **Date:** 2026-11-27
> **Objective:** Aplicar el checklist de seguridad: protección de contraseñas filtradas y rate limit de signup/login en Better Auth, acceso explícitamente denegado a la Data API de Supabase en todas las tablas, y headers de seguridad HTTP en Next.js.

## Why this spec exists

El checklist `references/security/security-checklist.md` y el linter de Supabase (7 avisos `rls_enabled_no_policy`) piden cinco cosas: RLS, contraseña mínima de 8, protección de contraseñas filtradas, límite de signups por IP y headers de seguridad.

La app autentica con **Better Auth** (SPEC 06), no con Supabase Auth. Por eso la contraseña mínima, las contraseñas filtradas y el rate limit se implementan en `lib/auth/auth.ts`, no en el dashboard de Supabase. El mínimo de 8 caracteres ya existe (`minPasswordLength: 8`); esta spec solo lo verifica.

RLS ya está activo y sin policies en todas las tablas: eso deniega todo por defecto, y la app accede solo desde el servidor por `DATABASE_URL` (SPEC 04/07). El lint es de nivel INFO. La decisión es hacer explícito ese bloqueo: revocar los grants de `anon`/`authenticated` y agregar policies restrictivas `using (false)`.

## Scope

**In:**

- Plugin `haveIBeenPwned` (de `better-auth/plugins`) en `lib/auth/auth.ts`. Rechaza en el signup por email las contraseñas que aparecen en brechas conocidas. Usa k-anonymity: solo se envían los 5 primeros caracteres del hash SHA-1.
- `rateLimit` de Better Auth con `storage: "database"` y `customRules`:
  - `/sign-up/email`: 3 solicitudes por IP cada 3600 s.
  - `/sign-in/email` y `/sign-in/username`: 5 solicitudes por IP cada 60 s.
  - Resto de rutas `/api/auth/*`: default global de Better Auth (100 / 10 s).
  - `enabled` queda en el default de Better Auth (solo en producción).
- Migración Supabase `create_rate_limit_table`: tabla `rateLimit` con el esquema de Better Auth (ver Data model), RLS activo y sin acceso para `anon`/`authenticated`.
- Migración Supabase `deny_data_api_access`, sobre las 8 tablas de `public` (`user`, `session`, `account`, `verification`, `jwks`, `games`, `best_scores`, `rateLimit`):
  - `revoke all on <tabla> from anon, authenticated`.
  - Una policy restrictiva `deny_data_api` por tabla: `as restrictive for all to anon, authenticated using (false) with check (false)`.
- Regenerar `lib/supabase/database.types.ts` y volver a agregar sus comentarios manuales.
- `components/auth-form.tsx`: el código de error `PASSWORD_COMPROMISED` muestra bajo el campo contraseña el mensaje `CONTRASEÑA FILTRADA EN BRECHAS. ELIGE OTRA.` El 429 sigue mostrando el `MSG.rateLimit` existente.
- `next.config.ts`: `headers()` con `source: "/(.*)"` y estos headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Desinstalar `@better-auth/infra`. Hoy está agregado en `package.json` y `package-lock.json`, sin commitear.
- Paso manual en el dashboard de Supabase Auth (lo hace el usuario): mínimo 8 caracteres, leaked password protection activa y signups deshabilitados. Así no queda una vía de registro paralela que la app no usa.
- Actualizar `CLAUDE.md`: sección Base de datos (deny explícito, tabla `rateLimit`) y sección Auth (`haveIBeenPwned`, rate limit).
- Marcar los ítems como hechos en `references/security/security-checklist.md`.

**Out of scope (for future specs):**

- Rate limit de las rutas propias `/api/contacto` y `/api/scores`.
- Content-Security-Policy.
- `@better-auth/infra` / `sentinel()`: bot blocking, credential stuffing, geo-blocking.
- CAPTCHA, verificación de email, 2FA, cambio y reset de contraseña.
- Auditoría de dependencias (`npm audit`) y gestión o rotación de secretos.
- Envío del dominio a hstspreload.org.

## Data model

### Tabla `public."rateLimit"` (Better Auth)

Usar el SQL que genere `npx @better-auth/cli generate` con la config final, no un esquema escrito a mano. Esquema esperado:

| Columna       | Tipo      | Restricción          |
| ------------- | --------- | -------------------- |
| `id`          | `text`    | `primary key`        |
| `key`         | `text`    | `not null`, `unique` |
| `count`       | `integer` | `not null`           |
| `lastRequest` | `bigint`  | `not null`           |

RLS activo, sin grants para `anon`/`authenticated`, con la policy `deny_data_api`.

### Policies `deny_data_api`

Una por tabla de `public`. Restrictiva, `for all to anon, authenticated using (false) with check (false)`. El rol de `DATABASE_URL` (`postgres`) hace bypass de RLS, así que la app no se ve afectada.

### Config Better Auth (`lib/auth/auth.ts`)

```ts
rateLimit: {
  storage: "database",
  customRules: {
    "/sign-up/email": { window: 3600, max: 3 },
    "/sign-in/email": { window: 60, max: 5 },
    "/sign-in/username": { window: 60, max: 5 },
  },
},
plugins: [username(...), jwt(), haveIBeenPwned()],
```

### UI

- `MSG.passwordCompromised = "CONTRASEÑA FILTRADA EN BRECHAS. ELIGE OTRA."` en `components/auth-form.tsx`, mostrado como error del campo contraseña.

### Archivos tras esta spec

- Modificados: `lib/auth/auth.ts`, `components/auth-form.tsx`, `next.config.ts`, `lib/supabase/database.types.ts`, `package.json`, `package-lock.json`, `CLAUDE.md`, `references/security/security-checklist.md`.
- Migraciones (vía MCP `apply_migration`): `create_rate_limit_table`, `deny_data_api_access`.

## Implementation plan

1. `npm uninstall @better-auth/infra`. Comprobar que `npm run build` pasa.
2. Headers en `next.config.ts`: antes, leer en `node_modules/next/dist/docs/` la guía de `headers`. Verificar con `curl -I` en `npm start`.
3. Agregar `haveIBeenPwned()` a `plugins` en `lib/auth/auth.ts`. Mapear `PASSWORD_COMPROMISED` al error del campo contraseña en `auth-form.tsx`.
4. Migración `create_rate_limit_table` (usar las skills `/supabase` y `/supabase-postgres-best-practices`). Después, `rateLimit` con `storage: "database"` y `customRules` en `auth.ts`.
5. Migración `deny_data_api_access`: revoke y policies en las 8 tablas. Comprobar que la app sigue funcionando por `DATABASE_URL`: login, top 10 y guardado de puntuación.
6. Regenerar `database.types.ts` y volver a agregar sus comentarios manuales. Revisar `get_advisors` (security).
7. Paso manual del dashboard de Supabase Auth (lo hace el usuario; ver Scope).
8. Actualizar `CLAUDE.md` y marcar el checklist.

## Acceptance criteria

- [ ] `curl -I` sobre `/` con `npm start` devuelve los 5 headers con los valores indicados.
- [ ] Registrarse con `password123` falla y muestra el mensaje de contraseña filtrada bajo el campo contraseña. Una contraseña aleatoria fuerte registra bien.
- [ ] Una contraseña de menos de 8 caracteres se rechaza en cliente y en servidor.
- [ ] Con `npm run build && npm start`, el 4.º signup desde la misma IP en una hora responde 429 y el formulario muestra `MSG.rateLimit`.
- [ ] Con `npm run build && npm start`, el 6.º login en un minuto desde la misma IP responde 429.
- [ ] La tabla `rateLimit` recibe filas durante esas pruebas.
- [ ] `get_advisors` (security) ya no reporta `rls_enabled_no_policy` en ninguna tabla.
- [ ] Con la publishable key, un `select` por la Data API a `games` y a `user` devuelve error de permiso o vacío, nunca filas.
- [ ] Siguen funcionando: login (email, username, Google, GitHub), detalle del juego con top 10, salón de la fama y guardado de puntuación.
- [ ] `@better-auth/infra` no está en `package.json`. `npm run lint` y `npm run build` pasan.
- [ ] El usuario confirma en el dashboard de Supabase Auth: mínimo 8, leaked password protection activa y signups deshabilitados.

## Decisions

| Decisión                                                   | Alternativa descartada                         | Por qué                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Better Auth nativo (`haveIBeenPwned` + `rateLimit`)        | `sentinel()` de `@better-auth/infra`           | Sin servicio externo ni API key. `@better-auth/infra` se desinstala.                 |
| Rate limit en base de datos (tabla `rateLimit`)            | `storage: "memory"`                            | La memoria es por instancia: en serverless casi no limita.                           |
| Signup 3/h por IP, login 5/min por IP                      | Solo signup 5/h; o 10/día y 10/min             | Balance entre anti-bot y redes compartidas.                                          |
| Revocar grants + policies restrictivas `using (false)`     | Solo policies; o no tocar y documentar el lint | Silencia el lint y deja documentado en la BD que la Data API no tiene acceso.        |
| Headers: los 3 del checklist + HSTS + Permissions-Policy   | Solo los 3; o incluir CSP                      | CSP es riesgosa con Next (scripts inline), OAuth y Resend, y agranda la spec.        |
| Contraseña filtrada como error del campo contraseña        | Error general del formulario (`.auth-error`)   | Señala directamente qué corregir.                                                    |
| Ajustes del dashboard de Supabase Auth como paso manual    | Dejarlos fuera de alcance                      | Aunque no se use, cierra una vía de registro paralela.                               |
| Rate limit de `/api/contacto` y `/api/scores` en otra spec | Incluirlo aquí                                 | Esta spec cubre solo el checklist. Contacto ya tiene honeypot y scores exige sesión. |

## Risks

| Riesgo                                                                              | Mitigación                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La API de HIBP está caída y eso bloquea o deja pasar signups                        | Verificado (better-auth 1.7): **fail-closed**. Si HIBP no responde, el signup por email devuelve 500 y el formulario muestra `MSG.network`. El login no se ve afectado. |
| La IP detrás del proxy (`x-forwarded-for`) se resuelve mal y todos comparten límite | Verificar `advanced.ipAddress` en el entorno de deploy. En local se prueba con una sola IP.                                                                             |
| El revoke rompe algo que usaba la Data API                                          | Según `CLAUDE.md`, nada la usa para estos datos. Prueba de regresión en el paso 5.                                                                                      |
| El nombre de la tabla o columnas de `rateLimit` difiere del esperado                | Usar el SQL que genera la CLI de Better Auth.                                                                                                                           |
| HSTS con `preload` es difícil de revertir si el dominio no es definitivo            | Solo aplica sobre HTTPS. Revisar antes del deploy; no se envía a hstspreload.org en esta spec.                                                                          |

## What is **not** in this spec

- Rate limit de las APIs propias (`/api/contacto`, `/api/scores`).
- Content-Security-Policy.
- `@better-auth/infra` / `sentinel()`.
- CAPTCHA, verificación de email, 2FA, cambio y reset de contraseña.
- Auditoría de dependencias y rotación de secretos.
