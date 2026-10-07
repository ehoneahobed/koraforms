/**
 * Size limits shared by the server (server.ts) and the browser apps, so the two
 * sides cannot drift apart.
 */

/** Largest public response payload (the response JSON, attachments inlined as data URLs). */
export const MAX_PUBLIC_RESPONSE_BODY_BYTES = 2 * 1024 * 1024

/**
 * Largest HTTP body a custom server route accepts. The public response route
 * receives the response JSON as a string inside the request JSON, so a response
 * of MAX_PUBLIC_RESPONSE_BODY_BYTES grows by escaping: at most 2x (every quote
 * or backslash doubles), plus the envelope fields.
 */
export const MAX_ROUTE_REQUEST_BODY_BYTES = 2 * MAX_PUBLIC_RESPONSE_BODY_BYTES + 64 * 1024

/**
 * Largest serialized sync operation. The server refuses a larger upload and the
 * creator app refuses a larger local write before it is queued, so a write is
 * never accepted on the device and then rejected by the server.
 */
export const SYNC_MAX_OPERATION_BYTES = 512 * 1024

/**
 * Largest local operation in the respondent (public) database. It never syncs;
 * its largest write is a queued submission holding one response payload.
 */
export const PUBLIC_LOCAL_MAX_OPERATION_BYTES = MAX_PUBLIC_RESPONSE_BODY_BYTES + 64 * 1024

/** Largest multiplier the test-only rate-limit setting accepts. */
const MAX_TEST_RATE_LIMIT_SCALE = 100

/**
 * Multiplier for the server's per-address rate limits. Production always uses
 * 1. The e2e server sets KORAFORMS_TEST_RATE_LIMIT_SCALE because the whole
 * suite reaches it from one address (127.0.0.1): the creator specs alone use
 * about 30 /auth requests, the auth limit per minute, so on a fast machine a
 * later spec's sign-up is refused.
 */
export function resolveRateLimitScale(env: { NODE_ENV?: string; KORAFORMS_TEST_RATE_LIMIT_SCALE?: string }): number {
	if (env.NODE_ENV === 'production') return 1
	const scale = Number(env.KORAFORMS_TEST_RATE_LIMIT_SCALE)
	if (!Number.isInteger(scale) || scale < 1) return 1
	return Math.min(scale, MAX_TEST_RATE_LIMIT_SCALE)
}
