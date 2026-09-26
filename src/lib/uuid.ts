/** Matches a standard UUID, e.g. 550e8400-e29b-41d4-a716-446655440000 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Returns true when the value has the shape of a UUID.
 *
 * Use it before querying by an id that comes from the URL: the database rejects a malformed
 * UUID with an error, which would otherwise look like a server failure instead of a 404.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}