const commandAttrPattern = /#\[tauri::command\]\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/g;
const commandRegistrationPattern = /commands::([A-Za-z0-9_]+)/g;

export const rustCommandRegistrationBoundaryRule = {
  name: 'rust-command-registration-boundary',
  check(files) {
    const failures = [];
    const commands = new Set();
    for (const { rel, text } of files) {
      if (!rel.startsWith('src-tauri/src/commands/') || !rel.endsWith('.rs')) continue;
      for (const match of text.matchAll(commandAttrPattern)) {
        commands.add(match[1]);
      }
    }
    const lib = files.find((file) => file.rel === 'src-tauri/src/lib.rs');
    if (!lib) {
      failures.push('src-tauri/src/lib.rs: command registration file is missing');
      return failures;
    }
    const registered = new Set([...lib.text.matchAll(commandRegistrationPattern)].map((match) => match[1]));
    for (const command of commands) {
      if (!registered.has(command)) failures.push(`src-tauri/src/commands: Tauri command ${command} must be registered in invoke_handler`);
    }
    for (const command of registered) {
      if (!commands.has(command)) failures.push(`src-tauri/src/lib.rs: registered Tauri command ${command} does not exist`);
    }
    return failures;
  },
};
