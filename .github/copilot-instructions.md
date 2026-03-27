# Copilot / AI agent instructions — pwa

Keep this file short and actionable. Focus on the repository's concrete patterns, commands, and places to make changes.

## Big picture
- Framework: Next.js (app router) + TypeScript. See `package.json` for Next version.
- Purpose: PWA prototype UI for a post-op messaging portal (static UI + placeholders for backend integrations).
- Current state: Frontend-only prototype. Comments in `src/app/page.tsx` indicate planned Supabase integration for media and chat.

## Key files & what they reveal
- `src/app/page.tsx`: Primary landing UI; server-component style (no `use client`). Language toggle is visual-only. Contains comment: “Media uploads + secure chat will connect to Supabase next.”
- `src/app/layout.tsx`: Root layout using `next/font/google` (Geist fonts) and `globals.css`.
- `src/app/globals.css`: Tailwind import and CSS variables for light/dark themes.
- `postcss.config.mjs`: Uses `@tailwindcss/postcss` plugin (Tailwind v4 setup).
- `tsconfig.json`: Path alias `@/*` -> `./src/*`.
- `next.config.ts`: standard Next config placeholder.
- `package.json`: scripts `dev`, `build`, `start`, `lint`; dependencies show Next 16 + React 19 and Tailwind.

## Developer workflows (explicit commands)
- Start dev server: `npm run dev` (runs `next dev`).
- Build for production: `npm run build` (runs `next build`).
- Preview production: `npm run start` (runs `next start`).
- Lint: `npm run lint` (runs `eslint`).

When you need to modify UI or routes:
- Add pages/components under `src/app/` (app-router). Example: new route `src/app/settings/page.tsx`.
- Use the TypeScript path alias with imports: `import Foo from '@/components/Foo'`.

## Project-specific conventions & patterns
- App router server components are used by default (no `use client` at top). Add `"use client"` only when you need client-side hooks or event handlers.
- Styling: Tailwind classes are used inline in JSX; global theme variables live in `src/app/globals.css`.
- Fonts: `next/font/google` is used in `layout.tsx` via variable classes (e.g., `--font-geist-sans`). Keep the layout pattern when adding fonts.
- PostCSS/Tailwind: plugin configured in `postcss.config.mjs` — prefer utility-first classes and minimal custom CSS.

## Integration points discovered in code
- Supabase: explicitly mentioned in `src/app/page.tsx` as the next backend for media/chat — expect to add client/service code (e.g., `src/lib/supabase.ts`).
- Auth & case rooms: UI placeholders exist; there is no server-side API yet. Implement APIs under `src/app/api/*` if adding server endpoints.

## Examples for common tasks
- Add an import using alias:

  ```ts
  import Widget from '@/components/Widget';
  ```

- Run dev server and open http://localhost:3000:

  ```bash
  npm run dev
  ```

## What to avoid / watch-for
- Do not assume runtime backend exists — many features are UI placeholders.
- Avoid converting server components to client unless you need interactivity; prefer keeping components server-side for performance.

## Where to look next when adding features
- UI: `src/app/*` (layout, page, route groups)
- Styles: `src/app/globals.css` and `postcss.config.mjs`
- Config & tooling: `package.json`, `tsconfig.json`, `next.config.ts`

If any of these notes are incorrect or you want more detail (deployment, CI, or preferred branch workflow), tell me which area to expand and I will iterate.
