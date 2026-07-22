# KoraForms — Product Strategy & Implementation Plan

**Goal:** Build a free, Tally-like form builder as a micro-SaaS on top of Kora.js. Ship fast, grow via viral loop, monetize later.

---

## 1. What KoraForms Is

A web-based form builder that works like Notion — type to create, slash-command to insert question blocks. Free for everyone, unlimited forms, unlimited responses. Built on Kora.js for offline-first local persistence and real-time sync across devices.

**One-line pitch:** "The simplest way to create forms. Unlimited. Free."

**Key differentiator from Tally:** Built-in response analytics. Tally collects data but doesn't analyze it — you export to Google Sheets. KoraForms shows you charts, trends, and insights right in the dashboard. Forms + analytics in one tool.

---

## 2. Why Build This

1. **Validates Kora.js in production.** KoraForms is the first real-world app built on the framework. It proves the DX promise and surfaces rough edges before external developers hit them.

2. **Revenue path.** Tally hit $5M ARR with 11 people. A form builder with a generous free tier + premium features is a proven business model.

3. **Viral distribution.** Every form submitted shows "Made with KoraForms" — 40% of Tally's growth came from this. Each form is a billboard.

4. **Offline-first is a genuine advantage.** Form creators can build forms without internet. Respondents can fill forms offline (data submits when back online). This matters for field surveys, conferences, emerging markets.

---

## 3. Core Features (MVP — v0.1)

### Form Builder
- Notion-style block editor with slash commands
- Question types: short text, long text, email, phone, number, URL, date, multiple choice, checkboxes, dropdown, linear scale, star rating, file upload
- Multi-page forms with page breaks
- Required/optional per field
- Form title, description, cover image
- Real-time preview (side-by-side or toggle)

### Form Sharing
- Unique shareable link (koraforms.app/f/{slug})
- Embed via iframe (standard embed code)
- QR code generation for each form
- "Made with KoraForms" badge on all free forms

### Response Collection
- Submission storage with timestamp and metadata
- Table view of all responses (filterable, sortable)
- Individual response detail view
- CSV export
- Real-time submission count on dashboard

### Response Analytics (Differentiator)
- Per-question summary charts (bar, pie for choice fields; histogram for numbers)
- Response timeline (submissions over time)
- Completion rate (started vs submitted)
- Average completion time
- Word clouds for open-text responses

### User Accounts
- Sign up / sign in (email + password via @korajs/auth)
- Dashboard listing all user's forms
- Form duplication
- Form archiving / deletion

### Offline Support
- Form builder works offline (saves locally, syncs when connected)
- Form responses work offline (respondent's answers queue and submit when online)
- Dashboard loads instantly from local data

---

## 4. Feature Roadmap (Post-MVP)

### v0.2 — Logic & Personalization
- Conditional logic (show/hide questions based on answers)
- Answer piping (reference previous answers in later questions)
- Hidden fields (accept URL parameters)
- Custom thank you page
- Redirect on completion

### v0.3 — Integrations & Webhooks
- Webhooks (POST JSON on submission)
- Zapier / Make integration
- Google Sheets direct push
- Notion database sync
- Slack notification on submission
- Email notification to form creator

### v0.4 — Collaboration & Teams
- Workspaces / team accounts
- Shared form editing
- Role-based access (editor, viewer)
- Form templates gallery (community-contributed)

### v0.5 — Advanced Analytics
- Cross-question analysis (e.g., "people who chose X also said Y")
- NPS score calculator
- Drop-off funnel (which page/question causes abandonment)
- Response segmentation and filtering
- Export to PDF report

### v0.6 — Payments & Advanced Fields
- Stripe payment collection (one-time, subscription)
- E-signature field
- Matrix / grid questions
- Ranking questions
- Calculator / formula fields

### v0.7 — Monetization (Pro tier)
- Remove "Made with KoraForms" branding
- Custom domains (forms.yourdomain.com)
- Custom CSS injection
- Partial submission capture
- Team collaboration (5+ members)
- Priority support

---

## 5. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Kora.js (korajs, @korajs/react, @korajs/auth) | Dogfooding — we built it, we use it |
| **Frontend** | React 19 + TypeScript | Kora.js React bindings are ready |
| **Styling** | Tailwind CSS v4 | Fast iteration, consistent design |
| **Block Editor** | TipTap (ProseMirror) or custom | Slash commands, block types, extensible |
| **Charts** | Recharts or Chart.js | Lightweight, React-native charting |
| **Routing** | React Router or TanStack Router | SPA with client-side routing |
| **Sync Server** | @korajs/server + @korajs/auth/server | Built-in auth + sync |
| **Server Storage** | PostgreSQL (prod) / SQLite (dev) | Via @korajs/server stores |
| **Hosting** | Fly.io or Railway (via `kora deploy`) | Already supported in CLI |
| **Domain** | koraforms.app (or koraforms.io) | Clean, memorable |

---

## 6. Data Schema

```typescript
import { defineSchema, t } from 'korajs'

export default defineSchema({
  version: 1,
  collections: {
    // Form definitions
    forms: {
      fields: {
        title: t.string(),
        description: t.string().optional(),
        slug: t.string(),                    // URL-friendly ID
        ownerId: t.string(),                 // creator's user ID
        status: t.enum(['draft', 'published', 'closed']).default('draft'),
        settings: t.string().default('{}'),  // JSON: theme, branding, etc.
        createdAt: t.timestamp().auto(),
        updatedAt: t.timestamp().optional(),
        publishedAt: t.timestamp().optional(),
        submissionCount: t.number().default(0),
      },
      indexes: ['ownerId', 'slug', 'status'],
    },

    // Form blocks (questions, text, page breaks)
    blocks: {
      fields: {
        formId: t.string(),
        type: t.enum([
          'short_text', 'long_text', 'email', 'phone', 'number', 'url',
          'date', 'multiple_choice', 'checkboxes', 'dropdown',
          'linear_scale', 'star_rating', 'file_upload',
          'heading', 'paragraph', 'page_break', 'divider', 'image',
        ]),
        label: t.string(),                   // question text
        description: t.string().optional(),  // help text
        required: t.boolean().default(false),
        order: t.number(),                   // position in form
        options: t.string().default('{}'),   // JSON: choices, scale config, etc.
        validation: t.string().default('{}'),// JSON: min/max, pattern, etc.
        createdAt: t.timestamp().auto(),
      },
      indexes: ['formId', 'order'],
    },

    // Form submissions (responses)
    submissions: {
      fields: {
        formId: t.string(),
        respondentId: t.string().optional(), // anonymous or authenticated
        answers: t.string(),                 // JSON: { blockId: value }
        metadata: t.string().default('{}'),  // JSON: IP, user agent, duration
        status: t.enum(['complete', 'partial']).default('complete'),
        completedAt: t.timestamp().auto(),
        startedAt: t.timestamp().optional(),
      },
      indexes: ['formId', 'completedAt', 'status'],
    },
  },

  relations: {
    blockBelongsToForm: {
      from: 'blocks',
      to: 'forms',
      type: 'many-to-one',
      field: 'formId',
      onDelete: 'cascade',
    },
    submissionBelongsToForm: {
      from: 'submissions',
      to: 'forms',
      type: 'many-to-one',
      field: 'formId',
      onDelete: 'cascade',
    },
  },
})
```

---

## 7. Application Architecture

```
koraforms/
  src/
    schema.ts              # Kora schema (above)
    app.ts                 # createApp({ schema, sync, auth })
    main.tsx               # React entry point
    router.tsx             # Route definitions

    components/
      layout/
        Sidebar.tsx        # Navigation sidebar
        Header.tsx         # Top bar with user menu
      editor/
        FormEditor.tsx     # Main block editor
        BlockPicker.tsx    # Slash command menu
        blocks/            # One component per block type
          ShortText.tsx
          MultipleChoice.tsx
          ...
      form-renderer/
        FormRenderer.tsx   # Public form view (what respondents see)
        BlockRenderer.tsx  # Renders a single block for respondents
      responses/
        ResponseTable.tsx  # Table view of submissions
        ResponseDetail.tsx # Single response view
        Analytics.tsx      # Charts and insights
      dashboard/
        FormList.tsx       # User's forms list
        FormCard.tsx       # Form preview card
      auth/
        SignIn.tsx
        SignUp.tsx
      shared/
        Badge.tsx          # "Made with KoraForms"

    pages/
      Dashboard.tsx        # /dashboard — user's forms
      Editor.tsx           # /forms/:id/edit — form builder
      Responses.tsx        # /forms/:id/responses — submissions
      Analytics.tsx        # /forms/:id/analytics — charts
      PublicForm.tsx       # /f/:slug — public form for respondents
      Settings.tsx         # /settings — account settings

    hooks/
      useFormEditor.ts     # Block CRUD, ordering, editor state
      useFormAnalytics.ts  # Compute charts from submissions
      useSlashCommand.ts   # Slash command menu logic

    utils/
      slug.ts              # Generate URL-friendly slugs
      analytics.ts         # Aggregate submission data for charts
      export.ts            # CSV export logic

  server/
    server.ts              # Production server (sync + auth + static)
    seed.ts                # Optional: seed with sample forms

  public/
    favicon.ico
    og-image.png

  package.json
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
```

---

## 8. Key Pages & User Flows

### Flow 1: Create Account -> Build Form -> Share
1. User lands on koraforms.app -> "Get started for free"
2. Sign up with email/password (via @korajs/auth)
3. Dashboard shows "Create your first form"
4. Click -> opens form editor
5. Type form title, press Enter
6. Type `/` -> slash command menu appears
7. Select "Short text" -> add question
8. Repeat: add more questions
9. Click "Publish" -> form goes live
10. Copy link -> share with respondents

### Flow 2: Respondent Fills Form
1. Respondent opens koraforms.app/f/{slug}
2. Sees the form (no sign-in required)
3. Fills out answers, clicks Submit
4. Sees "Thank you" page with "Made with KoraForms" badge
5. Submission syncs to creator's account

### Flow 3: Creator Reviews Responses
1. Creator opens Dashboard -> clicks form
2. Sees response count badge
3. Opens "Responses" tab -> table of all submissions
4. Opens "Analytics" tab -> charts per question
5. Exports CSV if needed

---

## 9. Viral Growth Mechanics

### "Made with KoraForms" Badge
- Displayed on every free form's thank you page
- Links to koraforms.app with UTM tracking
- Clean, tasteful — not intrusive
- Removing it is the primary Pro upgrade incentive

### Form Sharing
- Every published form has a clean URL
- Auto-generated Open Graph meta for link previews (form title + description)
- QR code for physical sharing (events, printed materials)

### Templates Gallery
- Curated library of form templates (feedback, survey, registration, quiz, etc.)
- Each template is a working form users can duplicate
- SEO-optimized template pages drive organic traffic
- "Use this template" -> sign up -> edit -> publish

### Build in Public
- Public changelog / blog
- Share milestones (form count, submission count)
- Active on relevant communities (Indie Hackers, X, Reddit)

---

## 10. Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Set up proper routing (React Router replacing hash routing)
- [ ] Integrate @korajs/auth (sign up, sign in, sign out)
- [ ] Migrate schema to blocks-based design (forms + blocks + submissions)
- [ ] Build authenticated dashboard (list forms, create form)
- [ ] Add "Made with KoraForms" badge to form fill page
- [ ] Generate unique slugs for published forms

### Phase 2: Editor & Block System (Week 3-4)
- [ ] Implement slash command menu in form builder
- [ ] Refactor field system to block-based architecture
- [ ] Block reordering (drag and drop)
- [ ] Block settings (required, help text, options for choice fields)
- [ ] Real-time preview mode (side-by-side)
- [ ] Form settings panel (status, slug, theme)

### Phase 3: Form Renderer & Submissions (Week 5-6)
- [ ] Public form renderer at /f/:slug route
- [ ] Form submission flow (validate -> save -> thank you page)
- [ ] Response table with filtering and sorting
- [ ] Individual response detail view
- [ ] CSV export improvements
- [ ] Form duplication

### Phase 4: Analytics (Week 7-8)
- [ ] Per-question summary charts (bar, pie for choice fields)
- [ ] Response timeline chart (submissions over time)
- [ ] Completion rate and average time metrics
- [ ] Word frequency for text responses
- [ ] Dedicated analytics dashboard page

### Phase 5: Polish & Launch (Week 9-10)
- [ ] Landing page redesign for production
- [ ] SEO meta tags for all pages
- [ ] Expand form templates (10-15 curated templates)
- [ ] Mobile-responsive optimization
- [ ] QR code generation for forms
- [ ] Embed code generation (iframe)
- [ ] Deploy to production
- [ ] Product Hunt launch prep

---

## 11. Success Metrics

### Launch (Month 1)
- 100+ sign-ups
- 500+ forms created
- 1,000+ submissions collected

### Growth (Month 3)
- 1,000+ sign-ups
- 5,000+ forms created
- 50,000+ submissions collected
- 30%+ of new users from "Made with KoraForms" badge

### Scale (Month 6)
- 10,000+ users
- 50,000+ forms
- 500,000+ submissions
- Ready to introduce Pro tier

---

## 12. What We're NOT Building (Yet)

- Payment collection (Stripe) — v0.6
- Conditional logic — v0.2
- Team collaboration — v0.4
- Custom domains — v0.7
- API access — v0.3
- Mobile app — not planned
- AI form generation — later

Focus on the core loop first: **create form -> share -> collect responses -> see analytics.**

---

## 13. Competitive Advantages

| KoraForms | Tally | Google Forms |
|-----------|-------|-------------|
| Built-in analytics | Export to Sheets | Basic charts |
| Works offline | Online only | Online only |
| Open source framework | Closed source | Closed source |
| Unlimited free | Unlimited free | Unlimited free |
| "Made with" badge | "Made with" badge | Google branding |
| Modern block editor | Notion-style editor | Dated UI |
| Real-time sync | Server-rendered | Server-rendered |
| Self-hostable | SaaS only | SaaS only |

The offline-first capability is genuinely unique in the form builder space. Field researchers, conference organizers, and emerging-market users cannot use Tally or Google Forms without internet. KoraForms works everywhere.
