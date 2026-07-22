# KoraForms Feature Implementation Plan

> Zero-cost features only. No external API keys, paid services, or infrastructure costs.
> Ordered by competitive impact. Each phase is independently shippable.

---

## Phase 1 — Core Competitiveness

These are table-stakes features. Without them, power users won't consider KoraForms.

---

### 1.1 Conditional Logic / Branching

**Why:** Every competitor has this. It's the #1 requested feature for any form builder.

**How it works:**
- Each field can have visibility rules: "Show this field only if [field X] [equals/contains/is not] [value]"
- Multiple conditions with AND/OR logic
- In FormFill, skip hidden fields during navigation

**Schema changes (FormField interface in `src/types.ts`):**
```typescript
interface ConditionalRule {
  fieldId: string            // Which field to check
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than'
  value: string              // Value to compare against
}

interface FormField {
  // ... existing fields ...
  conditions?: ConditionalRule[]    // If set, field is shown only when ALL conditions are true
  conditionLogic?: 'and' | 'or'    // Default: 'and'
}
```

**No Kora schema migration needed** — conditions are stored inside the `fields` JSON string.

**Files to modify:**

| File | Change |
|------|--------|
| `src/types.ts` | Add `ConditionalRule` interface, extend `FormField` |
| `src/pages/FormBuilder.tsx` | Add condition editor UI per field |
| `src/pages/FormFill.tsx` | Filter visible fields, adjust navigation |
| `src/pages/FormResponses.tsx` | No change (responses still contain all field data) |

**FormBuilder UI:**
- Each field gets a "Show conditionally" toggle in the field editor
- When toggled, shows rule builder: `[Select field ▼] [equals ▼] [value input]`
- "Add condition" button for multiple rules
- AND/OR toggle between conditions
- Only fields ABOVE the current field are selectable as conditions (prevents circular deps)

**FormFill logic:**
```typescript
function isFieldVisible(field: FormField, values: Record<string, string>, fields: FormField[]): boolean {
  if (!field.conditions || field.conditions.length === 0) return true
  const logic = field.conditionLogic || 'and'
  const results = field.conditions.map(rule => evaluateRule(rule, values))
  return logic === 'and' ? results.every(Boolean) : results.some(Boolean)
}

// In navigation: skip invisible fields
const visibleFields = fields.filter(f => isFieldVisible(f, values, fields))
// currentIndex refers to visibleFields, not all fields
```

**Estimated complexity:** Medium. ~2-3 sessions.

---

### 1.2 Custom Thank-You Page

**Why:** Basic expectation. Users need to redirect respondents after submission or show custom messaging.

**How it works:**
- Form creator sets: custom message, redirect URL, or "allow another response" toggle
- After submission, show custom content instead of default "Thank you!"

**Schema changes (stored in form settings JSON):**

Add a `settings` field to the forms collection:

```typescript
// In src/schema.ts — add to forms collection:
settings: t.string().default('{}')

// Settings JSON structure:
interface FormSettings {
  thankYouMessage?: string       // Custom thank-you text (supports basic markdown)
  redirectUrl?: string           // URL to redirect after submission
  redirectDelay?: number         // Seconds before redirect (default: 3)
  allowMultiple?: boolean        // Show "Submit another" button (default: true)
  showResponseSummary?: boolean  // Show respondent their answers on thank-you page
}
```

**Kora schema version bump:** 4 → 5 (new `settings` field on forms)

**Files to modify:**

| File | Change |
|------|--------|
| `src/schema.ts` | Add `settings` field to forms, bump version to 5 |
| `server.ts` | Update schema to version 5 |
| `src/kora.ts` | Update schemaVersion to 5 |
| `src/pages/FormBuilder.tsx` | Add settings panel for thank-you config |
| `src/components/editor/FormSettings.tsx` | Extend with thank-you options |
| `src/pages/FormFill.tsx` | Read settings, render custom thank-you |

**FormFill submitted screen:**
```tsx
// If redirectUrl is set:
// Show "Redirecting in 3..." countdown, then window.location.href = redirectUrl

// If thankYouMessage is set:
// Render custom message instead of default "Thank you!"

// If showResponseSummary:
// Show a read-only summary of all answered fields below the thank-you message
```

**Estimated complexity:** Low. ~1 session.

---

### 1.3 Response Limits & Scheduling

**Why:** Essential for event registration, limited-capacity forms, timed surveys.

**How it works:**
- Max responses: Close form after N responses
- Date range: Form only accepts responses between start/end dates
- Closed message: Custom message when form is unavailable

**Schema changes (part of FormSettings):**

```typescript
interface FormSettings {
  // ... existing ...
  maxResponses?: number          // Close after N responses (0 = unlimited)
  opensAt?: number               // Timestamp: when form starts accepting
  closesAt?: number              // Timestamp: when form stops accepting
  closedMessage?: string         // Message shown when form is closed
}
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/editor/FormSettings.tsx` | Add limit/schedule inputs |
| `src/pages/FormFill.tsx` | Check limits before showing form |
| `server.ts` | Validate limits server-side on submission |

**Server-side enforcement (important — can't trust client):**
```typescript
// In POST /api/public/responses handler:
const settings = JSON.parse(form.settings || '{}')
if (settings.maxResponses > 0) {
  const count = await store.queryCollection('responses', {
    where: { formId: String(form.id) },
    count: true
  })
  if (count >= settings.maxResponses) {
    return { status: 403, body: { error: 'Form has reached maximum responses' } }
  }
}
if (settings.closesAt && Date.now() > settings.closesAt) {
  return { status: 403, body: { error: 'Form is no longer accepting responses' } }
}
if (settings.opensAt && Date.now() < settings.opensAt) {
  return { status: 403, body: { error: 'Form is not yet open' } }
}
```

**Estimated complexity:** Low. ~1 session.

---

### 1.4 Answer Piping

**Why:** Personalization makes forms feel conversational. "You said you work at {company_name}. How long have you been there?"

**How it works:**
- In any field label or description, use `{{field_id}}` to insert a previous answer
- Rendered in real-time during form fill

**No schema changes** — piping is a rendering feature in FormFill.

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/FormFill.tsx` | Add `pipeValues()` function, apply to labels/descriptions |

**Implementation:**
```typescript
function pipeValues(text: string, values: Record<string, string>, fields: FormField[]): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, fieldId) => {
    const value = values[fieldId]
    if (value) return value
    // Try matching by label
    const field = fields.find(f => f.label.toLowerCase().replace(/\s+/g, '_') === fieldId)
    return field ? (values[field.id] || match) : match
  })
}

// Usage in question rendering:
<h2>{pipeValues(field.label, values, fields)}</h2>
```

**FormBuilder hint:** Show available pipe variables in a tooltip when editing labels.

**Estimated complexity:** Low. ~0.5 session.

---

## Phase 2 — Power Features

Features that create meaningful differentiation from competitors.

---

### 2.1 File & Image Uploads (Offline-Capable)

**Why:** Photo capture for fieldwork is KoraForms' killer use case. No competitor handles offline file uploads.

**How it works:**
- New field type: `file`
- Supports camera capture on mobile (image/photo)
- Files stored as base64 in response data (like signatures) for small files
- For larger files: stored in IndexedDB locally, uploaded to server on sync

**Schema changes:**

```typescript
// In src/types.ts — add to FieldType:
'file'

// FormField extension:
interface FormField {
  // ... existing ...
  accept?: string            // File types: 'image/*', '.pdf,.doc', etc.
  maxSize?: number           // Max file size in MB (default: 10)
  capture?: 'environment' | 'user'  // Camera direction on mobile
  multiple?: boolean         // Allow multiple files
}
```

**Server changes:**

```typescript
// New endpoint: POST /api/public/uploads
// Accepts multipart/form-data
// Stores file to disk (./uploads/) or cloud storage
// Returns { url: '/uploads/{uuid}.{ext}' }

// In server.ts production config, serve /uploads as static files
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/types.ts` | Add 'file' to FieldType |
| `src/pages/FormBuilder.tsx` | Add file field config (accept, maxSize, capture) |
| `src/pages/FormFill.tsx` | File input with preview, camera capture |
| `server.ts` | File upload endpoint, static file serving |

**FormFill file input:**
```tsx
// Mobile-optimized:
<input type="file" accept={field.accept || 'image/*'} capture={field.capture} />
// Shows thumbnail preview after selection
// For images: compress to reasonable size before storing
// Store as base64 data URL in values (simple, works offline)
// For files > 2MB: store reference, upload separately
```

**Offline strategy:**
- Small files (< 2MB): Base64-encode directly into response data JSON
- Large files: Store in IndexedDB with a temporary reference ID, upload when online, replace reference with URL

**Estimated complexity:** High. ~3-4 sessions.

---

### 2.2 Calculated Fields & Hidden Fields

**Why:** Enables scoring, quizzes, order totals, and dynamic logic without external tools.

**How it works:**
- New field type: `calculated` (display-only, shows computed value)
- New field type: `hidden` (invisible to respondent, stores computed data)
- Formula syntax: `{field_id} + {field_id}` or predefined functions

**Schema changes:**

```typescript
// Add to FieldType:
'calculated' | 'hidden'

// FormField extension:
interface FormField {
  // ... existing ...
  formula?: string           // e.g., "{field_1} + {field_2}" or "SUM(field_1, field_2)"
  defaultValue?: string      // For hidden fields: static value or formula
}
```

**Supported formulas:**
```
Arithmetic: +, -, *, /
Functions: SUM(...), AVG(...), MIN(...), MAX(...), COUNT(...)
Conditionals: IF({field} == "yes", 10, 0)
String: CONCAT({field1}, " ", {field2})
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/types.ts` | Add field types + formula property |
| `src/pages/FormBuilder.tsx` | Formula editor with field picker |
| `src/pages/FormFill.tsx` | Formula evaluation engine, display calculated values |
| `src/utils/formula.ts` | New file: formula parser and evaluator |

**Estimated complexity:** Medium-High. ~2-3 sessions.

---

### 2.3 Webhooks

**Why:** Unlocks all integrations (Zapier, Make, n8n, Slack, Google Sheets) without building each one. Zero ongoing cost — just HTTP POST calls.

**How it works:**
- Form owner adds webhook URL(s) in form settings
- On each response submission, server POSTs the response data to the webhook URL
- Retry logic: 3 attempts with exponential backoff

**Schema changes (FormSettings):**

```typescript
interface FormSettings {
  // ... existing ...
  webhooks?: WebhookConfig[]
}

interface WebhookConfig {
  url: string                    // Target URL
  method?: 'POST' | 'PUT'       // Default: POST
  headers?: Record<string, string>  // Custom headers (e.g., API key)
  includeFormMeta?: boolean      // Include form title, field labels
  active?: boolean               // Enable/disable without deleting
}
```

**Webhook payload:**
```json
{
  "event": "response.created",
  "form": {
    "id": "abc123",
    "title": "Customer Feedback",
    "slug": "customer-feedback-x7k2"
  },
  "response": {
    "id": "def456",
    "submittedAt": 1721564400000,
    "data": {
      "field_1": "John Doe",
      "field_2": "john@example.com",
      "field_3": "5"
    },
    "fields": {
      "field_1": { "label": "Name", "type": "text" },
      "field_2": { "label": "Email", "type": "email" },
      "field_3": { "label": "Rating", "type": "rating" }
    }
  }
}
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/editor/FormSettings.tsx` | Webhook URL input, test button |
| `server.ts` | Fire webhooks after response insertion |
| `src/utils/webhook.ts` | Webhook payload builder (shared types) |

**Server implementation:**
```typescript
// After store.applyRemoteOperation(op):
const settings = JSON.parse(form.settings || '{}')
if (settings.webhooks?.length) {
  // Fire-and-forget (don't block the response)
  fireWebhooks(settings.webhooks, form, responseData, fields).catch(console.error)
}

async function fireWebhooks(webhooks, form, data, fields) {
  for (const hook of webhooks) {
    if (hook.active === false) continue
    const payload = buildWebhookPayload(form, data, fields, hook)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(hook.url, {
          method: hook.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...hook.headers },
          body: JSON.stringify(payload),
        })
        if (res.ok) break
      } catch {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
      }
    }
  }
}
```

**Estimated complexity:** Medium. ~1-2 sessions.

---

### 2.4 Embeddable Forms (Widget Modes)

**Why:** Let users embed forms on their websites. Tally.so's embed options drive significant adoption.

**How it works:**
- Already have iframe embed in ShareModal — extend with more modes
- Popup: Triggered by button click
- Slide-in: Panel from right side
- Full-page: Clean standalone URL (already works at /f/{slug})

**No schema changes needed.**

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/shared/ShareModal.tsx` | Add embed mode tabs with generated code |
| `src/pages/FormFill.tsx` | Add `?embed=1` query param support (hide nav, minimal chrome) |

**Embed code snippets generated in ShareModal:**

```html
<!-- Inline embed -->
<iframe src="https://forms.korajs.dev/f/my-form?embed=1"
  width="100%" height="600" frameborder="0"></iframe>

<!-- Popup button -->
<script src="https://forms.korajs.dev/embed.js"></script>
<button onclick="KoraForms.popup('my-form')">Open Form</button>

<!-- Slide-in widget -->
<script src="https://forms.korajs.dev/embed.js"></script>
<script>KoraForms.slideIn('my-form', { position: 'right' })</script>
```

**New file: `public/embed.js`** — Lightweight script (~2KB) that creates popup/slide-in containers.

**Estimated complexity:** Medium. ~1-2 sessions.

---

## Phase 3 — Growth & Engagement

Features that increase adoption, retention, and viral sharing.

---

### 3.1 URL Pre-fill

**Why:** Lets users pre-populate fields via URL parameters. Essential for CRM integrations, email campaigns, QR codes with context.

**How it works:**
- URL format: `/f/my-form?field_id=value&field_id2=value`
- Also support label-based: `/f/my-form?name=John&email=john@test.com`
- Pre-filled fields show the value but are still editable

**No schema changes needed.**

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/FormFill.tsx` | Parse URL params, seed initial values |

**Implementation:**
```typescript
// On mount, parse URL search params
const searchParams = new URLSearchParams(window.location.search)
const prefill: Record<string, string> = {}
for (const [key, value] of searchParams) {
  // Try matching by field ID first
  if (fields.find(f => f.id === key)) {
    prefill[key] = value
  } else {
    // Try matching by label (case-insensitive, spaces → underscores)
    const match = fields.find(f =>
      f.label.toLowerCase().replace(/\s+/g, '_') === key.toLowerCase()
    )
    if (match) prefill[match.id] = value
  }
}
// Merge into initial values state
```

**Estimated complexity:** Low. ~0.5 session.

---

### 3.2 Progress Saving / Resume Later

**Why:** Long forms lose respondents. Saving progress lets them come back and finish.

**How it works:**
- Auto-save answers to `localStorage` keyed by form slug + device ID
- On form load, check for saved progress and offer to resume
- Clear saved data on successful submission

**No schema or server changes needed.** Purely client-side.

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/FormFill.tsx` | Save/restore from localStorage, resume prompt |

**Implementation:**
```typescript
const STORAGE_KEY = `koraforms-progress-${formId}`

// Save on every answer change (debounced)
useEffect(() => {
  const timer = setTimeout(() => {
    if (Object.keys(values).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        values, currentIndex, savedAt: Date.now()
      }))
    }
  }, 500)
  return () => clearTimeout(timer)
}, [values, currentIndex])

// On mount, check for saved progress
const saved = localStorage.getItem(STORAGE_KEY)
if (saved) {
  const { values: savedValues, currentIndex: savedIndex, savedAt } = JSON.parse(saved)
  // Show prompt: "You have saved progress from {time}. Resume?"
}

// On submit, clear saved data
localStorage.removeItem(STORAGE_KEY)
```

**Estimated complexity:** Low. ~0.5 session.

---

### 3.3 Public Results / Live Dashboard

**Why:** Transparency for polls, voting, community surveys. Also a sharing/viral mechanism.

**How it works:**
- Form setting: "Show results publicly"
- Generates a results URL: `/f/{slug}/results`
- Read-only analytics view (reuse existing AnalyticsView component)

**Schema changes (FormSettings):**

```typescript
interface FormSettings {
  // ... existing ...
  publicResults?: boolean         // Allow anyone to view results
  showResultsAfterSubmit?: boolean // Show results page after submission
}
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/editor/FormSettings.tsx` | Toggle for public results |
| `server.ts` | New endpoint: GET `/api/public/forms/{slug}/results` |
| `src/pages/PublicResults.tsx` | New page: read-only analytics |
| `src/main.tsx` | Add route `/f/:slug/results` |
| `src/pages/FormFill.tsx` | Link to results after submission |

**Server endpoint:**
```typescript
// GET /api/public/forms/{slug}/results
// Returns: { form: {...}, responses: [...] }
// Only if form.settings.publicResults === true
```

**Estimated complexity:** Medium. ~1-2 sessions.

---

### 3.4 Multi-Language Form Support

**Why:** Opens KoraForms to non-English markets. Critical for Africa, Middle East, South Asia.

**How it works:**
- Form creator adds translations for each language
- Respondent picks their language on the welcome screen
- Field labels, descriptions, options all translatable
- RTL support for Arabic, Hebrew, etc.

**Schema changes:**

```typescript
// FormField extension:
interface FormField {
  // ... existing ...
  translations?: Record<string, {
    label?: string
    placeholder?: string
    options?: string        // Translated comma-separated options
    description?: string
  }>
}

// FormSettings extension:
interface FormSettings {
  // ... existing ...
  languages?: string[]           // e.g., ['en', 'fr', 'ar', 'sw']
  defaultLanguage?: string       // e.g., 'en'
}
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/types.ts` | Add translations to FormField |
| `src/pages/FormBuilder.tsx` | Language tab per field for translations |
| `src/pages/FormFill.tsx` | Language picker on welcome screen, render translated labels |

**FormFill language selection:**
```tsx
// Welcome screen shows language selector if form has multiple languages
{settings.languages?.length > 1 && (
  <div className="flex gap-2">
    {settings.languages.map(lang => (
      <button key={lang} onClick={() => setLanguage(lang)}>
        {LANGUAGE_NAMES[lang]}
      </button>
    ))}
  </div>
)}

// Field rendering uses translated label:
const label = field.translations?.[language]?.label || field.label
```

**RTL support:**
```tsx
// Detect RTL languages
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur']
const isRtl = RTL_LANGUAGES.includes(language)

// Apply to form container
<div dir={isRtl ? 'rtl' : 'ltr'}>
```

**Estimated complexity:** Medium-High. ~2-3 sessions.

---

## Phase 4 — Collaboration & Platform

Features that turn KoraForms from a tool into a platform.

---

### 4.1 Team Workspaces

**Why:** Organizations need shared access to forms. Without this, each person creates their own account and can't share.

**How it works:**
- Users can create a "workspace" (team/org)
- Invite members by email
- Shared forms visible to all workspace members
- Roles: Owner (full access), Editor (edit forms), Viewer (view responses only)

**Schema changes (new collections):**

```typescript
// Add to schema:
workspaces: {
  fields: {
    name: t.string(),
    ownerId: t.string(),
    createdAt: t.timestamp().auto(),
  },
  indexes: ['ownerId'],
},

workspaceMembers: {
  fields: {
    workspaceId: t.string(),
    userId: t.string(),
    role: t.enum(['owner', 'editor', 'viewer']).default('viewer'),
    invitedBy: t.string().default(''),
    joinedAt: t.timestamp().auto(),
  },
  indexes: ['workspaceId', 'userId'],
},

// Extend forms collection:
forms: {
  fields: {
    // ... existing ...
    workspaceId: t.string().default(''),  // Empty = personal form
  }
}
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/schema.ts` | Add workspace collections, extend forms |
| `server.ts` | Update schema, add invite/join endpoints |
| `src/pages/FormList.tsx` | Workspace switcher, show shared forms |
| `src/App.tsx` | Workspace context provider |
| `src/components/workspace/` | New: WorkspaceSwitcher, InviteModal, MemberList |

**Estimated complexity:** High. ~4-5 sessions.

---

### 4.2 REST API Access

**Why:** Developers want to programmatically create forms, read responses, and build integrations.

**How it works:**
- API key generation in dashboard settings
- RESTful endpoints for forms and responses
- Rate limiting (simple in-memory counter)

**Endpoints:**

```
GET    /api/v1/forms                    — List forms
POST   /api/v1/forms                    — Create form
GET    /api/v1/forms/:id                — Get form
PUT    /api/v1/forms/:id                — Update form
DELETE /api/v1/forms/:id                — Delete form
GET    /api/v1/forms/:id/responses      — List responses
GET    /api/v1/forms/:id/responses/:rid — Get single response
DELETE /api/v1/forms/:id/responses/:rid — Delete response
POST   /api/v1/forms/:id/responses      — Submit response
```

**Auth:** API key in `Authorization: Bearer {key}` header.

**Files to modify:**

| File | Change |
|------|--------|
| `server.ts` | Add /api/v1/* routes with API key auth |
| `src/schema.ts` | Add apiKeys collection |
| `src/pages/Settings.tsx` | New page: API key management |
| `src/App.tsx` | Add /settings route |

**Estimated complexity:** Medium. ~2 sessions.

---

### 4.3 Approval Workflows

**Why:** Many use cases need human review: scholarship applications, leave requests, grant proposals.

**How it works:**
- Form setting: "Require approval"
- Responses get status: pending → approved/rejected
- Reviewer can add comments
- Respondent gets notified (if email provided)

**Schema changes:**

```typescript
// Extend responses collection:
responses: {
  fields: {
    // ... existing ...
    status: t.enum(['submitted', 'pending_review', 'approved', 'rejected']).default('submitted'),
    reviewedBy: t.string().default(''),
    reviewedAt: t.timestamp(),
    reviewNote: t.string().default(''),
  }
}

// FormSettings extension:
interface FormSettings {
  // ... existing ...
  requireApproval?: boolean
  reviewers?: string[]          // User IDs who can review
  notifyOnSubmission?: boolean  // Notify reviewers of new submissions
}
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/schema.ts` | Add review fields to responses |
| `src/pages/FormResponses.tsx` | Add review actions (approve/reject/comment) |
| `src/components/responses/ReviewPanel.tsx` | New: Review UI component |

**Estimated complexity:** Medium. ~2 sessions.

---

### 4.4 PDF Report Generation

**Why:** Field workers submit reports to funders. One-click PDF export with charts and formatted data.

**How it works:**
- Client-side PDF generation (no server cost)
- Uses `jsPDF` + `html2canvas` (or similar zero-cost library)
- Generates branded PDF with form title, response summary, charts

**Dependencies:** `jspdf` (MIT license, zero cost)

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/FormResponses.tsx` | "Export PDF" button |
| `src/utils/pdf.ts` | New: PDF generation logic |

**Estimated complexity:** Medium. ~1-2 sessions.

---

## Phase 5 — Polish & Delight

Small features that make the product feel premium.

---

### 5.1 Keyboard Shortcuts in Form Fill

```
Enter     → Next question (already implemented)
Shift+Enter → Previous question
1-9       → Select option (for radio/select)
Y/N       → Yes/No fields
Escape    → Close form
Tab       → Skip to next field
```

**Estimated complexity:** Low. ~0.5 session.

---

### 5.2 Response Duplicate Detection

- Hash the response data on submission
- Warn if an identical response was submitted recently (within 5 minutes)
- Prevents accidental double-submits

**Estimated complexity:** Low. ~0.5 session.

---

### 5.3 Form Analytics Enhancements

- **Completion funnel:** Show drop-off at each question (requires tracking partial submissions)
- **Average completion time:** Track time from start to submit
- **Device/browser breakdown:** From user-agent on submission
- **Geographic breakdown:** From IP-based country lookup (free APIs)

**Estimated complexity:** Medium. ~1-2 sessions.

---

### 5.4 Offline Dashboard (View Analytics Without Internet)

- Cache form responses in the Kora sync layer (already happens for authenticated users)
- FormResponses already works offline for authenticated users
- Add explicit "Available offline" badge
- Pre-cache analytics data for quick loading

**Estimated complexity:** Low. ~0.5 session (mostly UX polish).

---

## Implementation Order & Timeline

| # | Feature | Phase | Sessions | Dependencies |
|---|---------|-------|----------|-------------|
| 1 | **Conditional Logic** | 1 | 2-3 | None |
| 2 | **Custom Thank-You Page** | 1 | 1 | Schema v5 (settings field) |
| 3 | **Response Limits & Scheduling** | 1 | 1 | Schema v5 (settings field) |
| 4 | **Answer Piping** | 1 | 0.5 | None |
| 5 | **URL Pre-fill** | 3 | 0.5 | None |
| 6 | **Progress Saving** | 3 | 0.5 | None |
| 7 | **Webhooks** | 2 | 1-2 | Schema v5 (settings field) |
| 8 | **Embeddable Forms** | 2 | 1-2 | None |
| 9 | **Keyboard Shortcuts** | 5 | 0.5 | None |
| 10 | **Duplicate Detection** | 5 | 0.5 | None |
| 11 | **File/Image Uploads** | 2 | 3-4 | New server endpoint |
| 12 | **Calculated Fields** | 2 | 2-3 | Formula parser |
| 13 | **Public Results** | 3 | 1-2 | Schema v5 (settings field) |
| 14 | **Multi-Language** | 3 | 2-3 | None |
| 15 | **REST API** | 4 | 2 | API key management |
| 16 | **Team Workspaces** | 4 | 4-5 | Schema v6 (new collections) |
| 17 | **Approval Workflows** | 4 | 2 | Schema v6 |
| 18 | **PDF Export** | 4 | 1-2 | jspdf dependency |

**Recommended build order for maximum impact:**
1. Items 1-4 (Phase 1 core) — schema v5 migration, biggest competitive gap
2. Items 5-6 (quick wins) — zero-risk, high-value
3. Items 7-8 (webhooks + embed) — platform stickiness
4. Items 9-10 (polish) — quick delight
5. Items 11-14 (differentiators) — what makes KoraForms unique
6. Items 15-18 (platform) — when you have traction

---

## Schema Migration Strategy

**Version 5** (Phase 1-3):
- Add `settings` field to `forms` collection
- No breaking changes — new field with default `'{}'`

**Version 6** (Phase 4):
- Add `workspaces` and `workspaceMembers` collections
- Add `workspaceId` to `forms`
- Add review fields to `responses`

Both migrations are additive (no data loss, no breaking changes).

---

## Technical Notes

- **All FormField extensions** (conditions, translations, formula, accept, etc.) are stored inside the `fields` JSON string — no schema migration needed for these
- **FormSettings** is stored in a new `settings` JSON string field on forms — single schema migration covers all settings-based features
- **Webhooks** are fire-and-forget from the server — no queue infrastructure needed
- **PDF generation** happens client-side — no server cost
- **File uploads** for small files use base64 in response data — no additional storage infrastructure needed initially
