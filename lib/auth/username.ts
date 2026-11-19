export const USERNAME_MIN = 3;
export const USERNAME_MAX = 10;
const FALLBACK = "player";

/** Minúsculas, quita todo lo que no sea [a-z0-9_] y recorta a 10. */
export function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX);
}

function withFallback(candidate: string): string {
  return candidate.length < USERNAME_MIN ? FALLBACK : candidate;
}

/** GitHub: login normalizado. */
export function candidateFromLogin(login: string): string {
  return withFallback(normalizeUsername(login));
}

/** Google: parte local del email normalizada. */
export function candidateFromEmail(email: string): string {
  return withFallback(normalizeUsername(email.split("@")[0] ?? ""));
}

/**
 * Devuelve `candidate` si está libre; si no, recorta y agrega sufijo numérico
 * (gabriel → gabriel1 → gabriel2…) sin pasar de 10 chars.
 */
export async function ensureUniqueUsername(
  candidate: string,
  isTaken: (username: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(candidate))) return candidate;

  for (let n = 1; ; n++) {
    const suffix = String(n);
    const next = candidate.slice(0, USERNAME_MAX - suffix.length) + suffix;
    if (!(await isTaken(next))) return next;
  }
}
