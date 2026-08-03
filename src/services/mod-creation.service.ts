import { createNewMod } from '@/shared/api/mod-creation-api';
import type { CreatedMod, CreateModRequest } from '@/shared/types';

export function createNewModProject(request: CreateModRequest): Promise<CreatedMod> {
  return createNewMod(request);
}
