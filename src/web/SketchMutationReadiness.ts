// A05 v2: neutral presentation-readiness registry for sketch coordinate mutations.
// Keyed by the current document identity + active sketch ID; the registered value is a
// live getter owned by the Fusion stage (actual camera presentation, A03/A04/A05).
// Derived readiness only: not a document, camera, history or authoritative Boolean.

type ReadinessEntry = { token: number; isReady: () => boolean };

const registrations = new Map<string, ReadinessEntry>();
let nextToken = 1;

function keyOf(documentId: string, sketchId: string): string {
  return documentId + '\u0000' + sketchId;
}

/**
 * Register a live readiness getter for (document, sketch). Returns a token-bound
 * cleanup: a stale cleanup token never removes a newer attachment.
 */
export function registerSketchMutationReadiness(
  documentId: string,
  sketchId: string,
  isReady: () => boolean,
): () => void {
  const token = nextToken;
  nextToken += 1;
  const key = keyOf(documentId, sketchId);
  registrations.set(key, { token, isReady });
  return () => {
    const current = registrations.get(key);
    if (current && current.token === token) registrations.delete(key);
  };
}

/** Read at the moment of a mutation attempt; a missing registration fails closed. */
export function isSketchMutationReady(
  documentId: string | null | undefined,
  sketchId: string | null | undefined,
): boolean {
  if (!documentId || !sketchId) return false;
  const entry = registrations.get(keyOf(documentId, sketchId));
  return entry ? entry.isReady() : false;
}
