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
