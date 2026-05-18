import { rustFile } from '../shared/files.mjs';

const commandForbiddenPatterns = [/\bfilesystem::/, /\bparsers::/, /\bstd::fs\b/, /\bPath::new\b/, /\btauri::Manager\b/, /\bfs::/];

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
  for (const pattern of commandForbiddenPatterns) {
    if (pattern.test(text)) {
      failures.push(`${rel}: Rust command layer must only call service boundaries`);
      break;
    }
  }
  const serviceCalls = text.match(/\bservices::/g) ?? [];
  const commandFns = text.match(/#\[tauri::command\]/g) ?? [];
  if (commandFns.length > 0 && serviceCalls.length < commandFns.length) {
    failures.push(`${rel}: each Tauri command must call a service function`);
  }
}
