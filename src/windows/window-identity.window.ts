import type { FeedbackFileSession } from '@/shared/lib/feedback-session';

/// Session identity carried by child-window URLs (editor and file-editor
/// windows). The main window URL carries no session identity, so this returns
/// null there and the manifest lookup stays the only authorization source.
export function currentWindowSessionIdentity(): FeedbackFileSession | null {
  const params = new URLSearchParams(window.location.search);
  const modRoot = params.get('modRoot');
  const sessionId = params.get('sessionId');
  if (!modRoot || !sessionId) return null;
  return { modRoot, sessionId };
}
