import { rustFile } from '../shared/files.mjs';
import { cratePaths, rustLayerForCratePath } from '../shared/rust-crate-paths.mjs';

export const rustCommandServiceBoundaryRule = {
  name: 'rust-command-service-boundary',
  check(files) {
    const failures = [];
    for (const { rel, text } of files) {
      if (rustFile(rel) && rel.startsWith('src-tauri/src/commands/')) checkRustCommandFile(rel, text, failures);
    }
    return failures;
  },
};

function checkRustCommandFile(rel, text, failures) {
  for (const path of cratePaths(text)) {
    const layer = rustLayerForCratePath(path);
    if (layer !== 'services' && layer !== 'models' && layer !== 'other') {
      failures.push(`${rel}: Rust command layer must only depend on service boundaries and model types`);
    }
  }
  const serviceCalls = text.match(/\bservices::/g) ?? [];
  const commandFns = text.match(/#\[tauri::command\]/g) ?? [];
  if (commandFns.length > 0 && serviceCalls.length < commandFns.length) {
    failures.push(`${rel}: each Tauri command must call a service function`);
  }
}
