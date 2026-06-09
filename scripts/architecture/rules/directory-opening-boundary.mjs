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
const oldFrontendNames = [`scan${'Workspace'}Overview`, `detect${'Workspace'}Directory`];

export const directoryOpeningBoundaryRule = {
  name: 'directory-opening-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (isProjectCommandModule(file.rel)) {
        for (const name of openingCommandNames) {
          if (new RegExp(`\\b${name}\\s*\\(`).test(file.text)) {
            failures.push(`${file.rel}: Directory Opening commands must live in commands/directory_opening.rs`);
          }
        }
      }

      if (isProjectRootModule(file.rel)) {
        for (const name of projectRootOpeningNames) {
          if (new RegExp(`\\b${name}\\b`).test(file.text)) {
            failures.push(`${file.rel}: directory detection and overview logic must live in services/directory_opening`);
          }
        }
      }

      if (isProjectWireModel(file.rel)) {
        for (const typeDef of openingModelTypeDefs) {
          if (file.text.includes(typeDef)) {
            failures.push(`${file.rel}: Directory Opening wire models must live in models/directory_opening.rs`);
          }
        }
      }

      for (const name of oldFrontendNames) {
        if (new RegExp(`\\b${name}\\b`).test(file.text)) {
          failures.push(`${file.rel}: use Directory Opening service names instead of ${name}`);
        }
      }
    }
    return failures;
  },
};

function isProjectCommandModule(path) {
  return /^src-tauri\/src\/commands\/project\.rs$/.test(path);
}

function isProjectRootModule(path) {
  return /^src-tauri\/src\/services\/project\/root\.rs$/.test(path);
}

function isProjectWireModel(path) {
  return /^src-tauri\/src\/models\/project\.rs$/.test(path);
}
