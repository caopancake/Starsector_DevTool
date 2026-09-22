import { frontendFile } from '../../shared/files.mjs';

const openingCommandNames = ['open_project_session', 'detect_directory', 'scan_game_overview'];
const openingModelTypeDefs = [
  'struct OpenDirectoryResult',
  'enum OpenDirectoryKind',
  'struct GameOverviewData',
  'struct GameModSummary',
  'struct GameScanWarning',
];
const projectRootOpeningNames = [
  'OpenDirectoryResult',
  'OpenDirectoryKind',
  'GameOverviewData',
  'GameModSummary',
  'detect_directory',
  'scan_game_overview',
  'is_game_root',
  'is_mod_root',
  'infer_starsector_root',
];
const oldFrontendNames = ['scanWorkspaceOverview', 'detectWorkspaceDirectory'];

// Anchored per-file name lists: rel path -> names that must stay out of that
// file, expressed as a plain data table instead of per-file path predicates.
/** @type {Record<string, { words?: string[], typeDefs?: string[], message: string }>} */
const moduleAnchors = {
  'src-tauri/src/commands/project.rs': {
    words: openingCommandNames,
    message: 'Directory Opening commands must live in commands/directory_opening.rs',
  },
  'src-tauri/src/services/project/root.rs': {
    words: projectRootOpeningNames,
    message: 'directory detection and overview logic must live in services/directory_opening',
  },
  'src-tauri/src/models/project.rs': {
    typeDefs: openingModelTypeDefs,
    message: 'Directory Opening wire models must live in models/directory_opening.rs',
  },
};

export const directoryOpeningBoundaryRule = {
  name: 'directory-opening-boundary',
  /** @param {import('../../shared/files.mjs').RepoFile[]} files @returns {string[]} */
  check(files) {
    const failures = [];
    for (const file of files) {
      const anchor = moduleAnchors[file.rel];
      if (anchor) {
        for (const name of anchor.words ?? []) {
          if (new RegExp(`\\b${name}\\s*\\(`).test(file.text)) {
            failures.push(`${file.rel}: ${anchor.message}`);
          }
        }
        for (const typeDef of anchor.typeDefs ?? []) {
          if (file.text.includes(typeDef)) {
            failures.push(`${file.rel}: ${anchor.message}`);
          }
        }
      }

      if (frontendFile(file.rel)) {
        for (const name of oldFrontendNames) {
          if (new RegExp(`\\b${name}\\b`).test(file.text)) {
            failures.push(`${file.rel}: use Directory Opening service names instead of ${name}`);
          }
        }
      }
    }
    return failures;
  },
};
