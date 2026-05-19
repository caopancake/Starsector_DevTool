import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

export type { UnlistenFn };

export async function emitWindowEvent<T>(event: string, payload: T): Promise<void> {
  await emit(event, payload);
}

export async function listenWindowEvent<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(event, (message) => handler(message.payload));
}
