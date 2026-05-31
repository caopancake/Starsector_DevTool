import { querySessionCsvRowPreview, querySessionSourceOptions, querySessionTableWindow } from '@/services/query.service';
import { queryResourceDataUrls } from '@/services/resource-cache.service';
import { writeCsvPatch } from '@/services/write.service';
import { recordPerformance } from '@/services/performance.service';
import { isResourceRef } from '@/shared/lib/resource-ref';
import type {
  AssociatedFileChange,
  CsvFactionFilter,
  CsvRowPatch,
  CsvTableWindow,
  HydratedSourceOption,
  HydratedSourceOptionGroup,
  ProjectSessionId,
  SourceOption,
  TableKey,
  WriteResult,
} from '@/shared/types';

export function queryTableWindow(
  sessionId: ProjectSessionId,
  table: TableKey,
  start: number,
  count: number,
  search: string | null,
  faction: CsvFactionFilter,
): Promise<CsvTableWindow> {
  return querySessionTableWindow(sessionId, table, start, count, search, faction);
}

export async function queryTableSourceOptions(
  sessionId: ProjectSessionId,
  source: string,
  currentValues: string[],
  search: string | null,
  limit: number | null,
): Promise<HydratedSourceOptionGroup[]> {
  const startedAt = performance.now();
  const groups = await querySessionSourceOptions(sessionId, source, currentValues, search, limit);
  const resources = groups.flatMap((group) => group.options.map((option) => option.resourceRef).filter(isResourceRef));
  const dataUrls = await queryResourceDataUrls(sessionId, resources);
  let resourceIndex = 0;
  const hydrated = groups.map((group) => ({
    ...group,
    options: group.options.map((option) => {
      const resource = isResourceRef(option.resourceRef) ? option.resourceRef : null;
      return hydrateSourceOption(option, resource ? (dataUrls[resourceIndex++] ?? '') : '');
    }),
  }));
  recordPerformance('frontend.query.sourceOptions', performance.now() - startedAt, {
    source,
    groups: hydrated.length,
    options: hydrated.reduce((sum, group) => sum + group.options.length, 0),
    resources: resources.length,
  });
  return hydrated;
}

export function saveTablePatch(
  sessionId: ProjectSessionId,
  modRoot: string,
  table: TableKey,
  patches: CsvRowPatch[],
  associatedFiles: AssociatedFileChange[],
): Promise<WriteResult> {
  return writeCsvPatch(sessionId, modRoot, table, patches, associatedFiles);
}

export async function queryTableRowPreviewDataUrl(sessionId: ProjectSessionId, table: TableKey, rowKey: string): Promise<string> {
  const resource = (await querySessionCsvRowPreview(sessionId, table, rowKey)).resourceRef;
  if (!resource) return '';
  return (await queryResourceDataUrls(sessionId, [resource]))[0] ?? '';
}

function hydrateSourceOption(option: SourceOption, dataUrl: string): HydratedSourceOption {
  return { ...option, sprite: dataUrl };
}
