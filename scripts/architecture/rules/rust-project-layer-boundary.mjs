import { rustFile } from '../shared/files.mjs';
import { cratePaths } from '../shared/rust-crate-paths.mjs';

export const rustProjectLayerBoundaryRule = {
  name: 'rust-project-layer-boundary',
  check(files) {
    const failures = [];
    for (const file of files) {
      if (!rustFile(file.rel)) continue;
      if (testOnlyRustFile(file.text)) continue;
      const productionText = stripCfgTestBlocks(file.text);
      const from = rustLayer(file.rel);
      for (const parts of cratePaths(productionText)) {
        const reference = `crate::${parts.join('::')}`;
        const to = rustLayerFromCratePath(reference);
        if (!to) continue;
        if (from !== 'commands' && reference.startsWith('crate::models::command_payloads')) {
          failures.push(`${file.rel}: command payload models must stay inside Rust command modules`);
        }
        if (!validRustDependency(from, to)) {
          failures.push(`${file.rel}: ${from} must not depend on ${to} (${reference})`);
        }
      }
      if (from === 'project-query' && writesToDisk(productionText)) {
        failures.push(`${file.rel}: project query code must not write files or apply changesets`);
      }
      if (from === 'project-write' && /ProjectManifest|open_project_session/.test(productionText)) {
        failures.push(`${file.rel}: project write code must not perform project session opening`);
      }
      if (from === 'project-cache' && /load_core_references|load_all_core|core_references/i.test(productionText)) {
        failures.push(`${file.rel}: project cache must stay typed lazy and must not pre-read the full core set`);
      }
      if (from === 'project-root' && /\bpub\s+mod\b/.test(productionText)) {
        failures.push(`${file.rel}: project root module must not expose internal submodules`);
      }
      if (from === 'services' && /\bpub\s+fn\s+\w+\([^)]*\b[A-Za-z0-9_]*Payload\b/.test(productionText)) {
        failures.push(`${file.rel}: service functions must not accept command payload models`);
      }
    }
    return failures;
  },
};

function rustLayer(path) {
  if (path.startsWith('src-tauri/src/commands/')) return 'commands';
  if (path.startsWith('src-tauri/src/services/project/query/')) return 'project-query';
  if (path.startsWith('src-tauri/src/services/project/write/')) return 'project-write';
  if (path.startsWith('src-tauri/src/services/project/cache/')) return 'project-cache';
  if (projectServiceModule(path, 'mod')) return 'project-root';
  if (projectServiceModule(path, 'session')) return 'project-session';
  if (projectServiceModule(path, 'model')) return 'project-model';
  if (path.startsWith('src-tauri/src/services/')) return 'services';
  if (path.startsWith('src-tauri/src/domain/')) return 'domain';
  if (path.startsWith('src-tauri/src/io/')) return 'io';
  if (path.startsWith('src-tauri/src/parsers/')) return 'parsers';
  if (path.startsWith('src-tauri/src/models/')) return 'models';
  return 'other';
}

function testOnlyRustFile(text) {
  const trimmed = text.trimStart();
  return trimmed.startsWith('#[cfg(test)]') || trimmed.startsWith('#![cfg(test)]');
}

function stripCfgTestBlocks(text) {
  let output = text;
  const marker = '#[cfg(test)]';
  let index = output.indexOf(marker);
  while (index !== -1) {
    const blockStart = output.indexOf('{', index);
    if (blockStart === -1) break;
    let depth = 0;
    let end = blockStart;
    for (; end < output.length; end += 1) {
      const char = output[end];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    output = `${output.slice(0, index)}${output.slice(end)}`;
    index = output.indexOf(marker);
  }
  return output;
}

function rustLayerFromCratePath(path) {
  if (path.startsWith('crate::commands')) return 'commands';
  if (path.startsWith('crate::services::project::query')) return 'project-query';
  if (path.startsWith('crate::services::project::write')) return 'project-write';
  if (path.startsWith('crate::services::project::cache')) return 'project-cache';
  if (path.startsWith('crate::services::project::session')) return 'project-session';
  if (path.startsWith('crate::services::project::model')) return 'project-model';
  if (path.startsWith('crate::services')) return 'services';
  if (path.startsWith('crate::domain')) return 'domain';
  if (path.startsWith('crate::io')) return 'io';
  if (path.startsWith('crate::parsers')) return 'parsers';
  if (path.startsWith('crate::models')) return 'models';
  return null;
}

function projectServiceModule(path, moduleName) {
  return new RegExp(`^src-tauri/src/services/project/${moduleName}(?:\\.rs|/)`).test(path);
}

function validRustDependency(from, to) {
  if (from === 'commands') return to === 'services' || to === 'models';
  if (from === 'project-query') return ['project-model', 'project-cache', 'domain', 'io', 'parsers', 'models'].includes(to);
  if (from === 'project-write')
    return ['project-model', 'project-cache', 'project-query', 'domain', 'io', 'parsers', 'models'].includes(to);
  if (from === 'project-cache') return ['project-model', 'domain', 'io', 'parsers', 'models'].includes(to);
  if (from === 'project-session')
    return ['project-model', 'project-cache', 'project-query', 'domain', 'io', 'parsers', 'models'].includes(to);
  if (from === 'project-model') return ['domain', 'models'].includes(to);
  if (from === 'project-root') return ['project-session', 'project-query', 'models'].includes(to);
  if (from === 'services') return ['services', 'domain', 'io', 'parsers', 'models'].includes(to);
  if (from === 'domain') return to === 'domain' || to === 'models';
  if (from === 'io') return to === 'io' || to === 'parsers' || to === 'models';
  if (from === 'parsers') return to === 'parsers' || to === 'models';
  if (from === 'models') return to === 'models';
  return true;
}

function writesToDisk(text) {
  return /\bwrite_|remove_|rename_|create_dir|apply_file_change_set|save_/.test(text);
}
