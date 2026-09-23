import { pathBelongsToRoot } from '@/shared/lib/paths';

export interface FeedbackFileSession {
  modRoot: string;
  sessionId: string;
}

/// Resolves which session is authorized to open a file reference: a loaded
/// manifest owning the path wins; a child window opened for exactly one
/// session authorizes paths inside its own mod root as fallback.
export function resolveFeedbackFileSession(
  manifestModRoot: string | null,
  manifestSessionId: string | null,
  windowIdentity: FeedbackFileSession | null,
  path: string,
): FeedbackFileSession | null {
  if (manifestModRoot !== null && manifestSessionId !== null) {
    return { modRoot: manifestModRoot, sessionId: manifestSessionId };
  }
  if (windowIdentity !== null && pathBelongsToRoot(path, windowIdentity.modRoot)) {
    return windowIdentity;
  }
  return null;
}
