import { open } from '@tauri-apps/plugin-dialog';

export async function pickDirectoryDialog(title: string): Promise<string | null> {
  const picked = await open({ directory: true, multiple: false, title });
  if (!picked || Array.isArray(picked)) return null;
  return picked;
}

export async function pickFileDialog(options: { defaultPath?: string; title: string }): Promise<string | null> {
  const picked = await open({ defaultPath: options.defaultPath, multiple: false, title: options.title });
  if (!picked || Array.isArray(picked)) return null;
  return picked;
}

export async function pickEditorSpecFile(extension: string): Promise<string | null> {
  const picked = await open({
    multiple: false,
    title: `选择 .${extension} 文件`,
    filters: [{ name: `${extension} 文件`, extensions: [extension] }],
  });
  if (!picked || Array.isArray(picked)) return null;
  return picked;
}
