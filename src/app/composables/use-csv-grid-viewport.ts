import { computed, ref, type Ref } from 'vue';

export const CSV_GRID_ROW_HEIGHT = 24;
export const CSV_GRID_OVERSCAN_ROWS = 12;

export interface CsvGridViewportState<T> {
  afterHeight: Ref<number>;
  beforeHeight: Ref<number>;
  endIndex: Ref<number>;
  onScroll: (event: Event) => void;
  setViewportMetrics: (metrics: { clientHeight: number; scrollTop: number }) => void;
  startIndex: Ref<number>;
  visibleItems: Ref<T[]>;
}

export function useCsvGridViewport<T>(
  items: Ref<T[]>,
  options: { editingIndex: Ref<number>; overscan?: number; rowHeight?: number },
): CsvGridViewportState<T> {
  const rowHeight = options.rowHeight ?? CSV_GRID_ROW_HEIGHT;
  const overscan = options.overscan ?? CSV_GRID_OVERSCAN_ROWS;
  const scrollTop = ref(0);
  const viewportHeight = ref(0);

  const rawStartIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight) - overscan));
  const rawEndIndex = computed(() =>
    Math.min(items.value.length, Math.ceil((scrollTop.value + viewportHeight.value) / rowHeight) + overscan),
  );
  const startIndex = computed(() => includeEditingIndex(rawStartIndex.value, rawEndIndex.value, options.editingIndex.value).start);
  const endIndex = computed(() => includeEditingIndex(rawStartIndex.value, rawEndIndex.value, options.editingIndex.value).end);
  const visibleItems = computed(() => items.value.slice(startIndex.value, endIndex.value));
  const beforeHeight = computed(() => startIndex.value * rowHeight);
  const afterHeight = computed(() => Math.max(0, (items.value.length - endIndex.value) * rowHeight));

  function onScroll(event: Event) {
    const target = event.currentTarget as { clientHeight?: number; scrollTop?: number } | null;
    setViewportMetrics({ clientHeight: target?.clientHeight ?? 0, scrollTop: target?.scrollTop ?? 0 });
  }

  function setViewportMetrics(metrics: { clientHeight: number; scrollTop: number }) {
    scrollTop.value = metrics.scrollTop;
    viewportHeight.value = metrics.clientHeight;
  }

  return { afterHeight, beforeHeight, endIndex, onScroll, setViewportMetrics, startIndex, visibleItems };
}

function includeEditingIndex(start: number, end: number, editingIndex: number): { end: number; start: number } {
  if (editingIndex < 0) return { end, start };
  if (editingIndex < start) return { end, start: editingIndex };
  if (editingIndex >= end) return { end: editingIndex + 1, start };
  return { end, start };
}
