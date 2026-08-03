import { createNewMod } from '@/shared/api/mod-creation-api';
import type { CreatedMod, CreateModRequest } from '@/shared/types';

export function createModProject(request: CreateModRequest): Promise<CreatedMod> {
  return createNewMod(request);
}
