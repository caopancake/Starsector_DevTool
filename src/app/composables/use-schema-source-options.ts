import { computed, onUnmounted, ref, watch } from 'vue';
import type { FieldSchema } from '@/domain/schema/schema.types';
import { SCHEMA_SOURCE_OPTION_LIMIT, type SchemaRuntimeContext } from '@/domain/schema/schema-runtime';
import { fieldSourceCurrentValues, mapSourceGroupsToSelectOptions, type SelectOption } from '@/domain/schema/schema-options';
import { isCsvSource } from '@/domain/tables/csv-source-options';
import { schemaStableIdentity } from '@/domain/schema/schema-sections';
import type { ResourceRef } from '@/shared/types';

export function useSchemaSourceOptions(args: {
  field: () => FieldSchema;
  value: () => unknown;
  runtimeContext: () => SchemaRuntimeContext | null | undefined;
}) {
  const loadedOptions = ref<SelectOption[]>([]);
  const sourceOptions = computed<SelectOption[]>(() => loadedOptions.value);
  const currentValues = computed(() => fieldSourceCurrentValues(args.field(), args.value()));
  const currentValuesKey = computed(() => schemaStableIdentity(currentValues.value));
  let requestId = 0;
  let stopInvalidation: (() => void) | null = null;

  watch(
    () => [args.runtimeContext()?.sessionId ?? null, args.field().source ?? null, currentValuesKey.value] as const,
    () => {
      void reloadSourceOptions();
    },
    { immediate: true },
  );

  watch(
    () => [args.runtimeContext()?.sessionId ?? null, args.field().source ?? ''] as const,
    () => {
      stopInvalidation?.();
      const context = args.runtimeContext();
      const source = args.field().source ?? '';
      stopInvalidation =
        context?.subscribeSourceOptionInvalidation?.(source, loadedSourceResourceRefs, () => {
          void reloadSourceOptions();
        }) ?? null;
    },
    { immediate: true },
  );

  onUnmounted(() => stopInvalidation?.());

  async function reloadSourceOptions() {
    const activeRequestId = ++requestId;
    const context = args.runtimeContext();
    const sessionId = context?.sessionId ?? null;
    const source = args.field().source ?? null;
    if (!sessionId || !source || !isCsvSource(source)) {
      loadedOptions.value = [];
      return;
    }

    const groups = await context?.querySourceOptions?.(source, currentValues.value, undefined, SCHEMA_SOURCE_OPTION_LIMIT);
    if (activeRequestId !== requestId || sessionId !== args.runtimeContext()?.sessionId || source !== args.field().source) return;
    loadedOptions.value = groups ? mapSourceGroupsToSelectOptions(groups) : [];
  }

  function loadedSourceResourceRefs(): ResourceRef[] {
    return loadedOptions.value.flatMap((option) => [
      ...(option.resourceRef ? [option.resourceRef] : []),
      ...(option.children ?? []).flatMap((child) => (child.resourceRef ? [child.resourceRef] : [])),
    ]);
  }

  return {
    reloadSourceOptions,
    sourceOptions,
  };
}
