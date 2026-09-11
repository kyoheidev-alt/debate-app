const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Pulls a room UUID out of free-form student/chair input.
 * Accepts a bare ID, a pasted invite URL (`/r/{id}/enter`), or a message
 * that contains that URL. Returns lowercase canonical UUID, or null.
 */
export function extractRoomId(raw: string): string | null {
  const trimmed = raw.trim().replace(/^['"]+|['"]+$/g, "");
  if (!trimmed) return null;
  const match = trimmed.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}
