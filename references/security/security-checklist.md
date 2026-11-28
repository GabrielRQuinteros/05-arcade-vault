## Checklist de seguridad básico

- [x] RLS: Row Level Security habilitado en ambas tablas: `games` y `scores` — SPEC 13: RLS en las 8 tablas de `public` + `revoke` a `anon`/`authenticated` + policy restrictiva `deny_data_api`
- [x] Minimum password length — mínimo 8 caracteres — Better Auth `minPasswordLength: 8` (+ dashboard Supabase Auth)
- [x] Leaked password protection — (el warning 4) — plugin `haveIBeenPwned` de Better Auth (+ dashboard Supabase Auth)
- [x] Max signup rate — limitar signups por IP (anti-bot) — `rateLimit` de Better Auth en BD: signup 3/h, login 5/min por IP
- [x] Headers de seguridad en Next.js — `next.config.ts` `headers()`: los 3 de abajo + HSTS + Permissions-Policy

Ej:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

// En la config de Next.js:
headers: async () => [{ source: "/(.*)", headers: securityHeaders }];
```

## Por el lado de Supabase hay estas sugerencias:

| name                  | title                 | level | facing   | categories   | description                                                                                                     | detail                                                                 | remediation                                                                               | metadata                                                 | cache_key                                 | observed_at              |
| --------------------- | --------------------- | ----- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- | ------------------------ |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.account\\` has RLS enabled, but no policies exist      | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"account","type":"table"}      | rls_enabled_no_policy_public_account      | 2026-11-27T19:56:26.390Z |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.best_scores\\` has RLS enabled, but no policies exist  | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"best_scores","type":"table"}  | rls_enabled_no_policy_public_best_scores  | 2026-11-27T19:56:26.390Z |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.games\\` has RLS enabled, but no policies exist        | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"games","type":"table"}        | rls_enabled_no_policy_public_games        | 2026-11-27T19:56:26.390Z |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.jwks\\` has RLS enabled, but no policies exist         | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"jwks","type":"table"}         | rls_enabled_no_policy_public_jwks         | 2026-11-27T19:56:26.390Z |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.session\\` has RLS enabled, but no policies exist      | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"session","type":"table"}      | rls_enabled_no_policy_public_session      | 2026-11-27T19:56:26.390Z |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.user\\` has RLS enabled, but no policies exist         | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"user","type":"table"}         | rls_enabled_no_policy_public_user         | 2026-11-27T19:56:26.390Z |
| rls_enabled_no_policy | RLS Enabled No Policy | INFO  | EXTERNAL | ["SECURITY"] | Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created. | Table \\`public.verification\\` has RLS enabled, but no policies exist | https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy | {"schema":"public","name":"verification","type":"table"} | rls_enabled_no_policy_public_verification | 2026-11-27T19:56:26.390Z |
