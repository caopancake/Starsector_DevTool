import { nextTick, onUpdated, ref, watch, type Ref } from 'vue';

type SelectableRowElement = { classList: { add: (name: string) => void; remove: (name: string) => void } };
type SelectableBodyElement = { querySelector: (selector: string) => SelectableRowElement | null };

export function useTableDomSelection(bodyRef: Ref<SelectableBodyElement | null>, selectedRowKey: Ref<string | null>) {
  const selectedDomRow = ref<SelectableRowElement | null>(null);

  function handleRowClick(rowKey: string, event: MouseEvent, selectRow: (rowKey: string) => void) {
    setSelectedDomRow(event.currentTarget as SelectableRowElement | null);
    selectRow(rowKey);
  }

  function syncSelectedDomRow() {
    const key = selectedRowKey.value;
    if (!key) {
      setSelectedDomRow(null);
      return;
    }
    const escapedKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const row = bodyRef.value?.querySelector(`tr[data-row-key="${escapedKey}"]`) ?? null;
    setSelectedDomRow(row);
  }

  function setSelectedDomRow(row: SelectableRowElement | null) {
    if (selectedDomRow.value === row) return;
    selectedDomRow.value?.classList.remove('selected');
    selectedDomRow.value = row;
    selectedDomRow.value?.classList.add('selected');
  }

  watch(selectedRowKey, () => nextTick(syncSelectedDomRow));
  onUpdated(syncSelectedDomRow);

  return { handleRowClick, syncSelectedDomRow };
}
