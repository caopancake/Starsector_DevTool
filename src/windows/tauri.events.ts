import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

export type { UnlistenFn };

export type WindowEventHandler<T> = (data: T) => void | Promise<void>;
export type WindowEventErrorHandler = (error: unknown, event: string) => void;

export async function emitWindowEvent<T>(event: string, data: T): Promise<void> {
  await emit(event, data);
}

export async function listenWindowEvent<T>(
  event: string,
  handler: WindowEventHandler<T>,
  onError: WindowEventErrorHandler,
): Promise<UnlistenFn> {
  return listen<T>(event, (message) => {
    void dispatchWindowEvent(message.payload, handler).catch((error: unknown) => onError(error, event));
  });
}

async function dispatchWindowEvent<T>(data: T, handler: WindowEventHandler<T>): Promise<void> {
  await handler(data);
}
