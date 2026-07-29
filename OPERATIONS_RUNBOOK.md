# KoraForms Operations Runbook

This runbook covers the production checks that keep KoraForms supportable without exposing respondent answers, resume tokens, webhook secrets, or visitor/session identifiers.

KoraForms is offline-first. Operational diagnostics must never block respondents from opening, filling, saving, or queueing submissions locally. Server-side checks are for operators and support workflows after data reaches the server.

## Required Secrets

Set these values before a public deployment:

| Name | Purpose |
| --- | --- |
| `KORA_AUTH_SECRET` | Signs auth/session tokens. |
| `KORA_METRICS_TOKEN` | Bearer token for `/api/ops/diagnostics`. |
| `DATABASE_URL` | PostgreSQL production data store. |
| `PUBLIC_URL` | Canonical public origin used for links and metadata. |
| `KORA_BACKUP_TOKEN` | Optional bearer token for protected backup endpoints. |
| `RESEND_API_KEY` | Optional. Email notifications stay disabled until this is configured. |

Keep `KORA_METRICS_TOKEN` and `KORA_BACKUP_TOKEN` out of client bundles and screenshots. Rotate them after accidental disclosure.

## Release Gate

Run these before promoting a production build:

```bash
pnpm run check
pnpm run test:e2e
```

The E2E suite should cover:

- Authenticated creator flow.
- Public respondent offline and queued submission flow.
- Backup and restore.
- Webhook settings and delivery visibility.
- Public marketing/template routes.

## Health Checks

Basic uptime:

```bash
curl https://<YOUR_APP_URL>/health
```

Protected aggregate diagnostics:

```bash
curl -H "Authorization: Bearer <KORA_METRICS_TOKEN>" \
  https://<YOUR_APP_URL>/api/ops/diagnostics
```

Expected response shape:

```json
{
  "generatedAt": 1785178324774,
  "forms": { "total": 10, "published": 6, "draft": 4, "closed": 0 },
  "responses": { "accepted": 250, "withClientSubmissionId": 250 },
  "resumeLinks": { "active": 12, "expired": 3, "revoked": 1 },
  "analyticsEvents": {
    "total": 1200,
    "byStatus": { "pending": 0, "syncing": 0, "accepted": 1200, "failed": 0 },
    "byType": {
      "viewed_form": 500,
      "started_form": 320,
      "answered_question": 250,
      "saved_progress": 30,
      "submitted_form": 100
    }
  },
  "sideEffects": {
    "total": 80,
    "byStatus": { "pending": 0, "delivering": 0, "delivered": 80, "failed": 0 },
    "byType": { "webhook": 60, "email": 20 },
    "recentFailures": []
  }
}
```

## Reading Diagnostics

`forms` is the high-level form inventory. A sudden mismatch between expected public forms and `published` usually points to an accidental draft/closed state, not a sync failure.

`responses.accepted` is the authoritative response count stored on the server. `withClientSubmissionId` should match for public submissions because client submission ids provide idempotency. If it is lower, inspect whether the records were imported, restored, or written by an old/local tool path.

`resumeLinks` shows only lifecycle counts. High `active` is normal for forms where respondents save progress. High `expired` is normal after expiration jobs run. Unexpected `revoked` growth should trigger an audit of owner actions.

`analyticsEvents.byStatus` should mostly be `accepted`. Small `pending` or `syncing` counts can be normal immediately after offline respondents reconnect. Persistent growth means analytics events are not draining.

`sideEffects.byStatus` tracks webhook and email delivery work. `failed` should be investigated. `pending` or `delivering` can be normal during bursts, but stale growth means the side-effect processor is lagging.

`sideEffects.recentFailures` includes only safe metadata: ids, delivery type, attempts, target host, timestamps, and a truncated failure message. It intentionally omits webhook payloads, response answers, headers, secrets, and full URLs.

## Common Incidents

### Public Form Does Not Open

1. Check `/health`.
2. Confirm the form is published in the creator settings.
3. Check browser console/network for asset or service worker failures.
4. Use public offline diagnostics only when requested by support: add `?diagnostics=1` or `?debug=offline` to the form URL.

### Offline Submission Did Not Appear Yet

1. Ask the respondent to reconnect and revisit the same form URL.
2. If they can share support diagnostics, confirm a queued submission exists and was not rejected.
3. Check `/api/ops/diagnostics` for `responses.accepted` movement and analytics `pending`/`failed` growth.
4. Treat this as a sync/admission issue only after the local queue confirms the submission could not drain.

### Webhook Failures

1. Open the form Settings tab and inspect delivery history.
2. Send a test event from the webhook card.
3. Check `sideEffects.recentFailures` for the target host, attempt count, and sanitized error.
4. Verify the webhook endpoint is HTTPS, reachable, and returns a 2xx response quickly.

Webhook failures must not block response acceptance. They should remain retryable side effects.

### Email Notification Failures

Email notifications are prepared but disabled until `RESEND_API_KEY` and a verified sender are configured. When enabled, email failures should appear as `email` side effects and must not block response acceptance.

### Analytics Looks Stale

1. Check `analyticsEvents.byStatus`.
2. If `pending` or `syncing` grows, test a fresh public form visit and submission.
3. If `failed` grows, inspect server logs for validation or schema errors.
4. Analytics events are useful product signals, not respondent-critical writes. Do not couple form completion to analytics delivery.

## Azure Commands

Follow logs:

```bash
az containerapp logs show \
  --name koraforms \
  --resource-group koraforms-rg \
  --follow
```

Update a secret:

```bash
az containerapp secret set \
  --name koraforms \
  --resource-group koraforms-rg \
  --secrets kora-metrics-token='<new-token>'
```

Restart by creating a new revision after env/secret updates:

```bash
az containerapp update \
  --name koraforms \
  --resource-group koraforms-rg \
  --set-env-vars KORA_METRICS_TOKEN=secretref:kora-metrics-token
```

## Support Safety

Support diagnostics may include:

- Aggregate counts.
- Operation or delivery ids.
- Form ids.
- Delivery target host names.
- Truncated infrastructure error strings.

Support diagnostics must not include:

- Raw response answers.
- Resume tokens.
- Passwords or auth secrets.
- Webhook signing secrets.
- Full webhook URLs with query strings.
- Visitor ids, session ids, or device fingerprints.
