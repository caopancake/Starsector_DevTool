import { frontendFile, rustFile, singleFileByRel } from '../shared/files.mjs';
import { importedProjectPaths } from '../shared/imports.mjs';

export const appDataSyncBoundaryRule = {
  name: 'app-data-sync-boundary',
  check(files) {
    const failures = [];
    const singleResourceApiPattern = new RegExp('\\bqueryResource' + 'DataUrl\\b|\\bquery_resource' + '_data_url\\b');
    const singleResourceTypePattern = new RegExp('\\bResourceDataUrl' + '(Payload|Result)\\b');
    const legacyMissionApiPattern = new RegExp(
      '\\b(scanMissionList|loadMissionListCsv|loadMission|scan_mission_list|load_mission_list_csv|load_mission)\\b',
    );
    const resourceCache = singleFileByRel(files, 'src/services/resource-cache.service.ts');
    for (const file of files) {
      if (frontendFile(file.rel)) {
        for (const imported of importedProjectPaths(file)) {
          if (imported.importedName === 'AppData' || imported.importedName === 'CoreReferences') {
            failures.push(`${file.rel}: full project data types are forbidden in query-backed ProjectSession architecture`);
          }
        }
        if (/\bAppData\b|\bCoreReferences\b|\bcoreReferences\b|\bloadProject\s*\(/.test(file.text)) {
          failures.push(`${file.rel}: frontend must use ProjectManifest/session query instead of full project data`);
        }
        if (/\bqueryCsvTableWindow\s*\([^)]*count\s*:\s*10000/s.test(file.text)) {
          failures.push(`${file.rel}: editor candidates must use source/entity query instead of full CSV window queries`);
        }
        if (singleResourceApiPattern.test(file.text) || singleResourceTypePattern.test(file.text)) {
          failures.push(`${file.rel}: resource data URLs must use the batch query boundary`);
        }
        if (legacyMissionApiPattern.test(file.text)) {
          failures.push(`${file.rel}: mission UI/data loading must use ProjectSession entity query`);
        }
        if (file !== resourceCache && !file.rel.startsWith('src/shared/api/') && /\bqueryResourceDataUrls\b/.test(file.text)) {
          failures.push(`${file.rel}: resource data URLs must go through resource-cache service`);
        }
        if (/hullOptions\s*=\s*computed[^=]*=>\s*\[\]|variantShipSprite\s*=\s*''|skinSprite\s*=\s*''/.test(file.text)) {
          failures.push(`${file.rel}: config entity UI must not use empty placeholder implementations`);
        }
        if (/\bfunction\s+closeWorkspace\b/.test(file.text)) {
          if (!/\bcloseProject\b/.test(file.text)) {
            failures.push(`${file.rel}: removing loaded mods must release ProjectSession explicitly`);
          }
          if (!/\binvalidateProjectRootCache\b/.test(file.text)) {
            failures.push(`${file.rel}: closing or switching workspace root must invalidate core cache explicitly`);
          }
        }
      }
      if (rustFile(file.rel)) {
        if (
          /struct\s+AppData\b|struct\s+CoreReferences\b|load_mod_data(?:_with_root)?\b|load_mod_data_with_root_traced\b/.test(file.text)
        ) {
          failures.push(`${file.rel}: Rust must not reintroduce full AppData loading or coreReferences payloads`);
        }
        if (singleResourceApiPattern.test(file.text) || singleResourceTypePattern.test(file.text)) {
          failures.push(`${file.rel}: resource data URLs must use the batch query boundary`);
        }
      }
    }
    return failures;
  },
};
