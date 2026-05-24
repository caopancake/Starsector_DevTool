import { computed, ref, watch } from 'vue';
import { useProjectStore } from '@/stores/project.store';
import { useTablesStore } from '@/stores/tables.store';
import { createCsvGridModel } from '@/domain/tables/csv-grid-model';
import { csvColumnSchemaFor } from '@/domain/tables/csv-column-schema';
import { recordPerformance } from '@/services/performance.service';
import { queryTableSourceOptions, queryTableWindow } from '@/services/csv-table.service';
import type { SelectOption } from '@/domain/schema/schema-registry';

export function useCsvTableViewModel() {
  const tables = useTablesStore();
  const project = useProjectStore();
  const loadedWindowKeys = ref(new Set<string>());
  const loadedSourceOptions = ref(new Map<string, SelectOption[]>());
  let windowRequestId = 0;

  const gridModel = computed(() =>
    createCsvGridModel(tables.currentTab, tables.visibleColumns, tables.filteredRows, tables.tableRowKey, loadedSourceOptions.value),
  );

  watch(
    () => [project.activeSessionId, tables.currentTab, tables.searchText, tables.currentFaction] as const,
    async ([sessionId, table]) => {
      if (!sessionId) return;
      windowRequestId += 1;
      tables.resetTableWindow(table);
      loadedWindowKeys.value = new Set();
      loadedSourceOptions.value = new Map();
      await loadTableWindow(0, 240);
      await loadSourceOptionsForVisibleColumns();
    },
    { immediate: true },
  );

  async function loadTableWindow(start: number, count: number) {
    const sessionId = project.activeSessionId;
    if (!sessionId || count <= 0) return;
    const table = tables.currentTab;
    const requestId = windowRequestId;
    const alignedStart = Math.max(0, Math.floor(start / 80) * 80);
    const windowCount = Math.max(160, Math.ceil(count / 80) * 80);
    const key = `${sessionId}:${table}:${tables.searchText}:${tables.currentFaction}:${alignedStart}:${windowCount}`;
    if (loadedWindowKeys.value.has(key)) return;
    loadedWindowKeys.value.add(key);
    const window = await queryTableWindow(sessionId, table, alignedStart, windowCount, tables.searchText, tables.currentFaction);
    if (requestId !== windowRequestId || table !== tables.currentTab) return;
    tables.applyTableWindow(window);
  }

  async function loadSourceOptionsForVisibleColumns() {
    const sessionId = project.activeSessionId;
    if (!sessionId) return;
    const sources = [
      ...new Set(tables.visibleColumns.map((column) => csvColumnSchemaFor(tables.currentTab, column)?.source).filter(Boolean)),
    ] as string[];
    const entries = await Promise.all(
      sources.map(async (source) => {
        const groups = await queryTableSourceOptions(sessionId, source, [], undefined, 500);
        const options = groups.map((group) => ({
          type: 'group' as const,
          label: group.label,
          value: group.label,
          children: group.options.map((option) => ({
            label: option.label,
            value: option.value,
            sprite: option.sprite ?? undefined,
            resourceRef: option.resourceRef ?? null,
          })),
        }));
        return [source, options] as const;
      }),
    );
    loadedSourceOptions.value = new Map(entries);
  }

  watch(
    () => gridModel.value.performanceSample,
    (sample) =>
      recordPerformance('frontend.csvGridModel', sample.ms, {
        columns: sample.columns,
        rows: sample.rows,
        sourceMs: sample.sourceMs,
        table: sample.table,
        widthMs: sample.widthMs,
      }),
    { immediate: true },
  );

  return {
    tables,
    gridModel,
    loadTableWindow,
  };
}
