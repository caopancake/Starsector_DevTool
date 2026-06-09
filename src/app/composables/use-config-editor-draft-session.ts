import {
  useEditTargetDraftSession,
  type EditTargetDraftSession,
  type EditTargetDraftSessionOptions,
} from '@/app/composables/use-edit-target-draft-session';

export function useConfigEditorDraftSession<TValue, TTarget, TLoadMeta = unknown, TSaveMeta = unknown>(
  options: EditTargetDraftSessionOptions<TValue, TTarget, TLoadMeta, TSaveMeta>,
): EditTargetDraftSession<TValue, TTarget, TLoadMeta, TSaveMeta> {
  return useEditTargetDraftSession(options);
}
