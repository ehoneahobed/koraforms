# KoraForms — Implementation Plan (Updated 2026-05-07)

This document tracks the implementation status of turning KoraForms from a local demo into a production multi-user SaaS.

---

## Phase 1: Authentication & User Accounts ✅ COMPLETE

**Goal:** Users can sign up, sign in, and only see their own forms.

### Completed:
- [x] `@korajs/auth` dependency installed
- [x] Schema v3 with `ownerId` and `slug` fields (`src/schema.ts`)
- [x] Auth client config (`src/auth.ts`)
- [x] Sign in page (`src/pages/SignIn.tsx`)
- [x] Sign up page (`src/pages/SignUp.tsx`)
- [x] App shell with auth flow, route guards, sign-out (`src/App.tsx`)
- [x] FormList scoped to current user (`src/pages/FormList.tsx`)
- [x] FormBuilder sets ownerId on form create (`src/pages/FormBuilder.tsx`)
- [x] Server auth routes integrated (`server.ts`)
- [x] Vite auth proxy (`vite.config.ts`)
- [x] Auth token passed to sync (`src/main.tsx`)
- [x] AuthProvider + useAuth hook (from `@korajs/auth/react`)

### Bug Fix (2026-05-07):
- [x] Fixed AuthClient response parsing — `signUp`/`signIn` now correctly unwrap the `{ data: { tokens } }` envelope from BuiltInAuthRoutes. Previously caused "Unauthorized" error because tokens were extracted from wrong nesting level.
  - Fixed in `@korajs/auth` client: `packages/auth/src/client/auth-client.ts`
  - Root cause: Server returns `{ data: { user, tokens: { accessToken, refreshToken } } }` but client expected `{ accessToken, refreshToken }` at top level
  - Fix handles both envelope formats (`{ data: ... }` wrapper and flat) for backwards compatibility

---

## Phase 2: Proper Routing & Shareable Links ✅ COMPLETE

**Goal:** Clean URLs, shareable form links with OG meta tags.

### Completed:
- [x] React Router v7 installed and configured
- [x] Route definitions in `src/App.tsx` (BrowserRouter + Routes)
- [x] Auth guard layout (`RequireAuth` component)
- [x] FormFill supports slug-based lookup (`src/pages/FormFill.tsx`)
- [x] Slug generation on publish (`src/pages/FormBuilder.tsx`)
- [x] All pages use React Router navigation
- [x] Server SPA fallback with OG meta injection (`server.ts`)
- [x] Hash routing completely removed

---

## Phase 3: "Made with KoraForms" Badge & Viral Mechanics ✅ COMPLETE

**Goal:** Every form submission becomes a marketing opportunity.

### Completed:
- [x] `src/components/shared/PoweredByBadge.tsx` — badge component
- [x] Badge integrated into form fill and thank-you pages
- [x] `src/components/shared/ShareModal.tsx` — share/embed modal (bottom-sheet on mobile)
- [x] `src/utils/embed.ts` — embed code generation
- [x] Social share buttons (Twitter/X, LinkedIn, WhatsApp)
- [x] Share modal accessible from FormBuilder (Share button) and FormList (menu item)
- [x] Auto-show ShareModal on first publish

---

## Phase 4: Response Analytics ✅ COMPLETE

**Goal:** Per-question charts and insights.

### Completed:
- [x] `src/utils/analytics.ts` — computation utilities (distribution, numeric, rating, boolean, text, timeline)
- [x] `src/components/analytics/DistributionChart.tsx` — horizontal bars for choice fields
- [x] `src/components/analytics/NumericChart.tsx` — histogram + stats (min/max/mean/median)
- [x] `src/components/analytics/RatingChart.tsx` — star distribution + average
- [x] `src/components/analytics/TimelineChart.tsx` — SVG area chart
- [x] `src/components/analytics/BooleanChart.tsx` — SVG donut chart
- [x] `src/components/analytics/TextSummary.tsx` — word frequency + stats
- [x] `src/components/analytics/SummaryCards.tsx` — overview metric cards
- [x] FormResponses already has comprehensive analytics (bar charts, calendar heatmap, per-field breakdowns)

**Note:** Used pure CSS + inline SVG for charts instead of Recharts — avoids a heavy dependency.

---

## Phase 5: Form Builder Enhancements ✅ COMPLETE

**Goal:** Polish the form builder with Notion-style editing.

### Completed:
- [x] `src/hooks/useSlashCommand.ts` — slash command state management
- [x] `src/components/editor/SlashCommandMenu.tsx` — searchable field type picker
- [x] HTML5 drag-and-drop field reordering in FormBuilder (no external library)
- [x] Form duplication in FormList
- [x] `src/components/editor/FormSettings.tsx` — slug editor, status toggle
- [x] FormSettings integrated into FormBuilder

---

## Phase 6: Templates & Polish ✅ COMPLETE

**Goal:** Expand templates, improve landing page, add SEO.

### Completed:
- [x] 18 form templates across 6 categories (up from 6)
  - Church & Religious (3), Events & Registration (3), Feedback & Surveys (5), Business & HR (4), Education (3), Data Collection (2)
- [x] `TEMPLATE_CATEGORIES` export for gallery organization
- [x] `src/pages/Templates.tsx` — full templates gallery with search, category tabs, cards
- [x] `/templates` route added, "Browse all templates" link in template picker
- [x] `src/utils/meta.ts` — SEO meta tag management
- [x] Meta tags set on landing, sign in, sign up pages
- [x] Mobile optimization pass:
  - Scale/rating button touch targets (40px → 44px)
  - FormBuilder top bar responsive (icon-only on mobile)
  - ShareModal bottom-sheet pattern on mobile
- [x] `src/components/shared/ErrorBoundary.tsx` — React error boundary wrapping App

---

## Phase 7: Deployment & Launch Prep ✅ COMPLETE

**Goal:** Deploy to production.

### Completed:
- [x] `sqlite-user-store.ts` — persistent SQLite-backed user store (replaces InMemoryUserStore)
  - Tables: `auth_users` (unique email, PBKDF2 hash+salt), `auth_devices` (foreign key, cascade delete)
  - WAL mode, verified persistence across server restarts
- [x] `.env.example` — environment variables template
- [x] `Dockerfile` — multi-stage build (builder + production)
- [x] `fly.toml` — Fly.io config (shared-cpu-1x, 512mb, persistent volume)
- [x] `.dockerignore`
- [x] `.github/workflows/deploy.yml` — CI/CD (typecheck → build → deploy to Fly.io)
- [x] `better-sqlite3` added as dev dependency for server-side user store
- [x] `server.ts` updated to use `SQLiteUserStore` and `DB_PATH` env var

### Remaining for launch:
- [ ] Domain registration (`koraforms.app` or alternative)
- [ ] DNS + SSL configuration on Fly.io
- [ ] Set `FLY_API_TOKEN` secret in GitHub repo
- [ ] Set `AUTH_SECRET` secret on Fly.io (`fly secrets set AUTH_SECRET=...`)
- [ ] Production smoke test (sign up, create form, publish, fill, check responses)
- [ ] Product Hunt submission prepared
- [ ] Social media posts scheduled

---

## Architecture Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Keep JSON fields in schema | Yes | Refactoring to `blocks` collection is large effort with no user-visible benefit for MVP. Do it in v0.2 with conditional logic. |
| React Router vs TanStack Router | React Router v7 | Wider ecosystem, more docs, simpler for our needs. |
| Pure CSS/SVG charts vs Recharts | Pure CSS/SVG | Avoids ~200KB dependency. Distribution bars, donut charts, area charts built with Tailwind + inline SVG. |
| HTML5 DnD vs @dnd-kit | HTML5 DnD | No extra dependency for MVP. Works well enough for field reordering. |
| SQLiteUserStore vs InMemoryUserStore | SQLite | Production requires persistence. Users survive server restarts. Same DB file as server store. |
| Auth response envelope handling | Client unwraps `{ data: ... }` | BuiltInAuthRoutes wraps all success responses in `{ data: T }`. Client gracefully handles both wrapped and flat formats. |
| QR code generation | Deferred | Not critical for MVP. Share modal has link copy, embed code, and social share buttons. |
| Slug format | `{title-slug}-{random6}` | Human-readable + unique. No collision risk even with identical titles. |
| Auth on public forms | Not required | Respondents fill forms without accounts. Only form creators need auth. |
| Server-side OG rendering | Inject into index.html | Full SSR is overkill. Just inject meta tags into the HTML shell for link previews. |

---

## File Inventory

### New Files Created:
```
src/
  auth.ts                              # Auth client config
  pages/
    SignIn.tsx                         # Sign in page
    SignUp.tsx                         # Sign up page
    Templates.tsx                      # Templates gallery
  components/
    shared/
      PoweredByBadge.tsx              # "Made with KoraForms" badge
      ShareModal.tsx                  # Share link, embed, social modal
      ErrorBoundary.tsx               # React error boundary
    editor/
      SlashCommandMenu.tsx            # Slash command popup
      FormSettings.tsx                # Form settings panel
    analytics/
      DistributionChart.tsx           # Bar chart for choice fields
      NumericChart.tsx                # Histogram + stats
      RatingChart.tsx                 # Star rating distribution
      TimelineChart.tsx               # Responses over time (SVG area)
      BooleanChart.tsx                # Yes/no donut (SVG)
      TextSummary.tsx                 # Word frequency + stats
      SummaryCards.tsx                # Overview metric cards
  hooks/
    useSlashCommand.ts                # Slash command logic
  utils/
    analytics.ts                      # Response analytics computation
    embed.ts                          # Embed code generation
    meta.ts                           # SEO meta tag management

sqlite-user-store.ts                  # SQLite-backed user & device store
.env.example                          # Environment variables template
Dockerfile                            # Production Docker image
fly.toml                              # Fly.io deployment config
.dockerignore                         # Docker ignore rules
.github/workflows/deploy.yml          # CI/CD pipeline
```

### Modified Files:
```
package.json                          # Added auth, react-router, better-sqlite3 deps
src/schema.ts                         # v3: added ownerId, slug fields
src/main.tsx                          # Auth token wired into sync
src/App.tsx                           # React Router, auth flow, route guards, error boundary
src/pages/Landing.tsx                 # Updated CTAs
src/pages/FormList.tsx                # Scoped to user, share menu, duplicate, template browse
src/pages/FormBuilder.tsx             # ownerId, slug, slash command, DnD, settings, share
src/pages/FormFill.tsx                # Slug-based lookup, improved touch targets
src/pages/FormResponses.tsx           # (already had comprehensive analytics)
src/templates.ts                      # Expanded from 6 to 18 templates + categories
server.ts                             # Auth routes, SQLiteUserStore, OG meta injection
vite.config.ts                        # Auth proxy
```

### Kora Framework Fix:
```
packages/auth/src/client/auth-client.ts  # Fixed response envelope unwrapping for signUp/signIn/refresh
```
