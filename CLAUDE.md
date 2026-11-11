# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: online game platform to play and compete for points. Spec-driven (`/spec`, `/spec-impl` skills from `Klerith/fernando-skills`, installed via `npx skills@latest add Klerith/fernando-skills`). Currently a fresh Create Next App scaffold (single commit, only `app/layout.tsx` + `app/page.tsx`). README is in Spanish.

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- No test runner configured.

## Stack / gotchas

- Next.js 16.4.6, React 19.3, Tailwind 4.3 (via `@tailwindcss/turbopack` loader rule in `next.config.ts`, not PostCSS), TypeScript strict.
- **Next.js has breaking changes vs. training data.** Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing code; heed deprecations.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback` — these change caching/rendering semantics; check docs before writing data fetching or dynamic code.
- App Router only (`app/`). Root layout uses global `LayoutProps<"/">` type (no import needed) and Geist fonts via `next/font/google`.
- Theming: CSS vars `--background`/`--foreground` in `app/globals.css`, exposed to Tailwind via `@theme inline`; dark mode via `prefers-color-scheme`.
- `AGENTS.md` block is auto-rewritten by `next dev`; commit it rather than removing it.
