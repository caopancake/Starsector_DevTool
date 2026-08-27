import { resolveModRelativePath } from '@/shared/api/query-api';

export function resolveModImageReference(sessionId: string, modRoot: string, absolutePath: string): Promise<string> {
  return resolveModRelativePath(sessionId, modRoot, absolutePath);
}
