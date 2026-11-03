# DESIGN BRIEF - Azubi Success theme rewrite (indigo/violet)

Worker task: apply the new indigo/violet design system across the Qwik frontend and fix six known issues. The design base is ALREADY DONE - do not touch it.

## Stack

Qwik City SPA + Tailwind CSS v4 (CSS-first `@theme` in `frontend/src/styles/global.css`). Icons: `lucide-qwik` only. Repo root: the frontend lives in `frontend/`.

## DONE by the lead (DO NOT EDIT these files)

- `frontend/src/styles/global.css` - token source of truth (violet primary scale, cyan accent scale, surface/border/text tokens, `.dark` overrides, `color-scheme`, `.gradient-text`, `.btn-gradient`, `.glass-card`, `.hero-mesh`, `.glow-orb` utilities)
- `frontend/src/root.tsx` - theme FOUC inline script
- `frontend/src/components/router-head.tsx` - Inter font links
- `frontend/public/favicon.svg`, `frontend/public/manifest.json`

Read `global.css` first to know the available tokens/utilities. Tailwind's default scales (indigo, fuchsia, etc.) also remain available.

## HARD RULES (violations = rejected)

1. ONLY edit files listed in "Your scope" below. Never edit `global.css`, `root.tsx`, `router-head.tsx`, stores, `utils/`, or anything under `backend/`, `infra/`, `docs/`.
2. No text/copy changes except where this brief explicitly provides the exact replacement copy.
3. No renames, no new dependencies, no aria-label changes, no route changes.
4. Keep every existing `dark:` variant working - restyle light AND dark together.
5. No emojis as icons; use lucide-qwik icons.
6. Finish with `cd frontend && npm run build && npm run typecheck` passing. Fix what you broke; if a pre-existing failure blocks you, report it, do not hack around it.
7. Do not commit. Leave changes in the working tree.

## Design language to apply

- Primary actions/buttons: violet. Primary buttons become `btn-gradient` (replaces `bg-primary-600 ... hover:bg-primary-700` - do NOT keep a `hover:bg-*` class on gradient buttons, it overrides the gradient).
- Hero/landing surfaces: `hero-mesh` backdrop + optional `.glow-orb` decor divs (violet `bg-primary-500/30`, cyan `bg-accent-500/20`).
- Headline emphasis: `gradient-text` on the accent span.
- Cards: `rounded-2xl border border-border bg-surface` may be upgraded to `glass-card` where it sits on colored backdrops; plain cards keep `shadow-[var(--shadow-card)]` or `shadow-card` feel via `shadow-xl shadow-primary-950/5`.
- Semantic accent colors for icon tiles (feature cards, quick actions, StatCard colors): use the token family only - `bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400`, `bg-accent-*` equivalents, `bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/40 dark:text-fuchsia-400`, `bg-emerald-*` for success, `bg-amber-*` for warnings. REMOVE red/yellow/purple/blue hardcodes that do not map to these (red stays ONLY for destructive/error semantics).
- Focus/keyboard, placeholders, scrollbars are handled globally already - do not add per-component overrides.

## Your scope (files you may edit)

`frontend/src/routes/index.tsx`, `frontend/src/routes/layout.tsx`, `frontend/src/routes/auth/login/index.tsx`, `frontend/src/routes/auth/register/index.tsx`, `frontend/src/routes/auth/reset-password/index.tsx`, `frontend/src/routes/auth/verify/index.tsx`, `frontend/src/routes/dashboard/index.tsx`, `frontend/src/components/organisms/Sidebar.tsx`, `frontend/src/components/organisms/Header.tsx`, `frontend/src/components/organisms/AskContainer.tsx`, `frontend/src/components/molecules/StatCard.tsx`

## Fix list (six known issues)

1. **Auth pages clipped under fixed header** (all four `auth/*` pages): the fixed public header (h-16) overlaps the auth content. Add top clearance (e.g. wrap page content in `pt-28 pb-16` or equivalent) so logo/heading are fully visible.
2. **Sidebar broken Settings item** (`Sidebar.tsx`): the bottom NavItem has label "SettingsIcon" (typo) and href `/dashboard/settings` or `/admin/settings` - routes that do not exist. REMOVE that NavItem entirely. Keep the Sign Out button.
3. **Fake landing stats** (`routes/index.tsx`): replace the `stats` array with honest product facts using EXACTLY: `{ value: "4", label: "Core SHS Subjects" }`, `{ value: "108", label: "Curriculum Documents" }`, `{ value: "24/7", label: "AI Support" }`, `{ value: "100%", label: "NaCCA Grounded" }`. Keep the same markup/section.
4. **Fake testimonials** (`routes/index.tsx`): REPLACE the entire testimonials section (Loved by Students Everywhere) with a "How it works" section, keeping a similar section wrapper. Heading: "How it works". Subtext: "Three steps from question to grounded answer, built on the NaCCA Senior High School curriculum." Three cards, each lucide icon + title + body EXACTLY: (1) MessageSquareIcon, "Ask your question", "Type any academic question in your own words - no special format needed."; (2) DatabaseIcon, "We search the curriculum", "The platform retrieves the matching NaCCA curriculum sections for your subject and level."; (3) LightbulbIcon, "Get a grounded answer", "Receive a clear answer with the curriculum sources it came from, available to save in your history." Remove the `testimonials` array and the StarIcon/GraduationCapIcon imports if now unused.
5. **Dark-mode polish + fake notification dot** (`Header.tsx`): remove the hardcoded red `absolute top-1.5 right-1.5` dot from the bell button (no real notification system exists). Keep the dropdown and its empty-state text.
6. **Footer dead links** (`routes/layout.tsx`): Support column - replace the three `href="#"` anchors: "Help Center" -> Link to `/#features`, "Privacy Policy" -> Link to `/#about`, and REMOVE the "Terms of Service" list item entirely. Keep column heading "Support". (Import Link from `@builder.io/qwik-city` if not already imported.)

## Restyle pass (same files)

- `routes/index.tsx`: hero section gets `hero-mesh` (replace the current `bg-gradient-to-br from-primary-50 ...` div), badge pill may keep structure, "Study Companion" span becomes `gradient-text` (drop the static `text-primary-600`), both hero CTAs: primary variant button gets `btn-gradient` class (keep size), "Get Started Free" text unchanged. Feature card icon tiles: retint the 6 `color:` values into the allowed token family (violet, cyan, fuchsia, emerald, amber, primary) - vary them, no rainbow chaos. Final CTA section: replace `bg-gradient-to-br from-primary-600 to-primary-800` with a violet->fuchsia->cyan gradient (`from-primary-700 via-primary-600 to-accent-600`); the white button there becomes `btn-gradient` with `!shadow-none` allowed - remove the `!bg-white !text-primary-700 hover:!bg-primary-50 !border-transparent` overrides.
- `routes/layout.tsx`: header nav "Get Started" button gets `btn-gradient` (both desktop and mobile menu). Footer stays token-clean.
- `dashboard/index.tsx` + `StatCard.tsx`: quick-action tiles retinted to the allowed token family. REMOVE fake data: delete the "Study Hours" StatCard (invented "24 / +23%"), on the "KB Articles" card remove the `trend`/`trendUp` props (keep the card, 108 is real), and DELETE the entire "Weekly Streak" widget (hardcoded 5-day fake). Keep only stats derived from real store data (Questions Asked, Answered, KB Articles). If StatCard's `trend`/`trendUp` props become unused, leave the component props intact (they may be used later) but stop passing fake values. If deleting cards leaves the grid unbalanced, 3 cards in the `lg:grid-cols-4` grid is fine.
- `AskContainer.tsx` / `QuestionInput.tsx` (only if needed): make the ask input focus state use primary tokens; no structural changes.
- Auth pages: while fixing clearance, upgrade the card to a calm token-clean look if it uses raw colors (it should already be token-clean).

## Verification (worker must run)

```
cd frontend
npm run build
npm run typecheck
```

Report: files changed, build/typecheck output tail, and anything you could not do.
